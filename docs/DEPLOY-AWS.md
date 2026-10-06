# Hosting on AWS

## Can it run as a static site on S3?

No, not the application itself. S3 static website hosting serves files only, and this app needs a running Node.js server:

- pages are rendered on the server, and actions (ask, approve, request access, reset) run on the server;
- the app state (gates, grants, answers, audit) lives in a database the server writes to;
- every number is computed when you ask, by queries against the DuckDB warehouse.

A static export would be screenshots in HTML. There would be no questions, no persona switching, no reset and no governed numbers.

Use the right service for each part:

| What | Where | Section |
|---|---|---|
| The application | **AWS App Runner**, running the project's Docker image (simplest), or one EC2 instance | [1](#1-host-the-application-on-app-runner) · [2](#2-alternative-one-ec2-instance-state-survives-restarts) |
| Static files (the leave-behind page, exported PDFs, docs) | **S3** static website, optionally behind CloudFront | [3](#3-host-static-files-on-s3) |

## Before you start

- An AWS account and the [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html), configured (`aws configure`).
- Docker on your machine.
- This repository, cloned.
- Two values used below:

```bash
export AWS_REGION=us-east-1                 # your region
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
```

All data in the app is synthetic. There is no customer data to protect, but treat `SESSION_SECRET` and any `ANTHROPIC_API_KEY` as secrets.

## 1. Host the application on App Runner

App Runner runs a container image behind HTTPS, with no servers to manage.

### 1.1 Build the image and push it to ECR

```bash
# One-time: a private image repository
aws ecr create-repository --repository-name keystone --region $AWS_REGION

# Log Docker in to ECR
aws ecr get-login-password --region $AWS_REGION \
  | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build for x86_64 (needed on Apple-silicon Macs). PREBUILD=deep bakes the warehouses of the 8 deep packs
# into the image, so first page loads are fast. Leave it out for a smaller image whose warehouses build on
# first use.
docker build --platform linux/amd64 --build-arg PREBUILD=deep -t keystone .

docker tag keystone:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/keystone:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/keystone:latest
```

### 1.2 Store the session secret

```bash
aws secretsmanager create-secret --name keystone/session-secret \
  --secret-string "$(openssl rand -hex 32)" --region $AWS_REGION
```

Optional: add a Live-mode key the same way, as `keystone/anthropic-api-key`. Without it the app runs in Scripted mode, which is deterministic and needs no network.

### 1.3 Create the service (console)

In the AWS console, go to **App Runner → Create service**, then:

1. **Source**: Container registry → Amazon ECR → browse to `keystone:latest`. Deployment trigger: *Manual*. ECR access role: *Create new service role*.
2. **Service settings**:
   - Name: `keystone-demo`.
   - CPU / memory: **2 vCPU / 4 GB**. DuckDB and the warehouse builds need the memory.
   - Port: **3000**.
3. **Environment variables**:
   - `SESSION_SECRET` → *Secrets Manager* → `keystone/session-secret`.
   - Optional: `ANTHROPIC_API_KEY` → *Secrets Manager* → `keystone/anthropic-api-key`.
   - Optional: `AGENT_MODE_DEFAULT` = `scripted`.

   App Runner adds the permission it needs to read those secrets when you pick them. If it reports an access error, attach `secretsmanager:GetSecretValue` for the two secrets to the service's *instance role*.
4. **Health check**: protocol **HTTP**, path **`/api/health`**.
5. **Create & deploy**. After a few minutes the service shows a default domain such as `https://abc123.us-east-1.awsapprunner.com`.

Open `https://<default domain>/launch`, pick an industry and start presenting.

### 1.4 Check it

```bash
curl https://<default domain>/api/health   # {"status":"ok"}
curl https://<default domain>/api/ready    # 200 once the packs and warehouses are ready
```

### 1.5 Things to know about App Runner

- **The demo state resets** whenever App Runner restarts or redeploys the container, because its disk is not persistent. Each start begins from the seeded demo. That is fine for demos; use [EC2](#2-alternative-one-ec2-instance-state-survives-restarts) if saved Demo Profiles must survive restarts.
- **Keep one instance.** Set *Auto scaling → max instances* to **1**. Each instance has its own database, so a second one would split presenters' state.
- **First open of a pack without prebuilt warehouses takes 5–15 s** while its warehouse builds. Packs built with `PREBUILD=deep` open immediately.
- **Custom domain**: App Runner → your service → *Custom domains*.
- **To update**: build and push a new `latest` image, then choose **Deploy** on the service.

## 2. Alternative: one EC2 instance (state survives restarts)

Use this when Demo Profiles, approvals and audit history must persist.

1. Launch an **Amazon Linux 2023** instance, `t3.large` (2 vCPU / 8 GB), 30 GB disk. Allow inbound TCP **3000** from your IP, or put a load balancer in front for HTTPS.
2. On the instance:

   ```bash
   sudo dnf install -y docker git && sudo systemctl enable --now docker
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64" -o /usr/local/libexec/docker/cli-plugins/docker-compose --create-dirs
   sudo chmod +x /usr/local/libexec/docker/cli-plugins/docker-compose
   git clone <this repository> keystone && cd keystone
   echo "SESSION_SECRET=$(openssl rand -hex 32)" > .env
   sudo docker compose up -d --build
   ```

3. Open `http://<instance public IP>:3000/launch`. State lives in the `keystone-data` Docker volume and survives restarts and rebuilds.

## 3. Host static files on S3

Use this for the leave-behind page, exported PDFs or documentation, not for the app.

```bash
export BUCKET=my-demo-leave-behind-$AWS_ACCOUNT_ID   # bucket names are global; this keeps it unique

aws s3 mb s3://$BUCKET --region $AWS_REGION
aws s3 website s3://$BUCKET --index-document index.html

# Allow a public-read bucket policy (S3 blocks public access by default)
aws s3api put-public-access-block --bucket $BUCKET \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false

aws s3api put-bucket-policy --bucket $BUCKET --policy "{
  \"Version\": \"2012-10-17\",
  \"Statement\": [{ \"Effect\": \"Allow\", \"Principal\": \"*\", \"Action\": \"s3:GetObject\",
                    \"Resource\": \"arn:aws:s3:::$BUCKET/*\" }]
}"

# Upload (the page is self-contained: screenshots are embedded)
aws s3 cp trust-the-number.html s3://$BUCKET/index.html --content-type "text/html; charset=utf-8"
```

The address is shown in the console under **S3 → bucket → Properties → Static website hosting**. It looks like `http://<bucket>.s3-website-<region>.amazonaws.com`.

S3 website endpoints are HTTP only. For HTTPS or a custom domain, create a **CloudFront** distribution with the bucket as its origin. You can then keep the bucket private, using CloudFront's Origin Access Control, and remove the public policy above.

To take the page down: `aws s3 rm s3://$BUCKET --recursive && aws s3 rb s3://$BUCKET`.

## Costs at a glance

- **App Runner** (1 instance, 2 vCPU / 4 GB) is billed per hour while running. Pause the service between demos (*Actions → Pause*) to stop compute charges.
- **EC2** `t3.large` is billed per hour while the instance runs. Stop it between demos.
- **S3 static hosting** for one page costs cents per month.

Check current prices on the AWS pricing pages for your region.
