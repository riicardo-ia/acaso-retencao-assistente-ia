<!-- traduzido de: fe682c380fc7 -->
# AWS architecture

How the dashboard runs on AWS: the same containers as `docker compose`, on managed services. The design follows the project's rule: the dashboard never reads the raw base, the number is calculated in the database and the screen only displays it.

![Architecture on AWS](img/arquitetura-aws.svg)

## Components

| Service | Role | Why |
|---|---|---|
| **S3** (private bucket) | raw base (Brazil parquet) and versioned topic labels | cheap, versionable; only the load has read permission |
| **ECS Fargate: load** | the same image as the `etl` service, running once a day | no server left on for nothing: the task starts, loads, checks and ends |
| **EventBridge** | schedules the load (for example, every day at 3 am) and the reclassification of topics, when needed | managed scheduling, with no cron on a machine of our own |
| **Bedrock** | LLM for the topic classification | the model and the cost stay on AWS; switching models is only configuration (LangChain, see DOCUMENTO §4) |
| **RDS PostgreSQL** | analytical base (`mart` schema) | small volume; automatic backup; SQL readable by anyone on the data team |
| **ECS Fargate: API** | the same image as the `app` service (FastAPI), always on | thin, read-only API, with a cache per load version |
| **ALB** | HTTPS entry point of the API, with a certificate | balances across the API tasks and checks their health (`/healthz`) |
| **Cognito** | client login, integrated with the ALB | each client sees only their own dashboard |
| **CloudFront + S3** | delivers the page (HTML, JS, CSS) | fast and cheap; the page is static |
| **Secrets Manager** | database passwords and the pseudonym salt | no secret in the code or in the image |
| **CloudWatch** | JSON logs, metrics and alarms for the load and the API | a single place to investigate |
| **ECR** | stores the images built by the CI | the deploy uses exactly the tested image |

## Two paths

**A load.** EventBridge triggers the load task, which reads the raw base and the topic labels from S3, applies the definitions, runs the statistical analysis and writes to RDS in a single transaction. Before publishing, it checks the return calculated in SQL against the one calculated in Python; if they diverge, nothing is published and an alarm fires. The load never calls the LLM: the topic classification is a separate task, run only when the topics need to be redone, and it writes the versioned labels to S3.

**A visit.** The person opens the dashboard address: the page comes from CloudFront. The login goes through Cognito. The page calls the API through the ALB; the API queries RDS with the `bi_app` role, which only reads the `mart` schema, and keeps the answer in memory until the next load.

## Network and security

- **Network:** only the ALB and CloudFront are exposed to the internet. The API, the load and the database live in private subnets; RDS has no public access.
- **Who talks to whom:** the API and the load reach the database on port 5432, open only to them. Access to S3, Bedrock and Secrets Manager uses private VPC endpoints, without going through the internet.
- **Permissions per service (IAM):** the load reads the raw base bucket, calls Bedrock and reads its own secrets; the API reads only the secret of the `bi_app` role. Nobody but the load reads the raw base.
- **Encryption:** at rest in S3 and RDS (KMS keys) and in transit (HTTPS and TLS on the database).
- **Personal data:** the raw base has conversation text and lives in the private bucket. The analytical base stores no text, IP or browser, and the API does not return numbers for groups with fewer than 30 people.

## Environments and deploy

- **Environments:** development, staging and production, separated (different accounts or VPCs), all with the same image.
- **Infrastructure as code:** CDK or Terraform, to recreate any environment identically.
- **Deploy:** on every change, the CI runs lint, type checks and tests; builds the image; stores it in ECR; updates staging. Staging receives the full load and the reconciliation; only then does the same image go to production (gradual replacement of the tasks, with automatic rollback if health checks fail).
- **Database:** migrations are new files, never edited, applied by the load and recorded in `mart.migracoes`.

## Monitoring and alarms

| What is measured | Where | Alarm |
|---|---|---|
| Load: duration, rows read, reconciliation | task logs and metrics; `mart.cargas` | load with an error, failed reconciliation or a load that did not run on the day |
| Number of people: "people ÷ IPs" ratio per week | load metric | ratio outside its history (the symptom of the incident) |
| API: time per route (p50, p95), errors | JSON logs with `request_id` | high p95 or 5xx errors above normal |
| Database: connections, CPU, space | RDS metrics | usage close to the limit |

## Cost

What goes into the bill: the hours of the Fargate tasks (the API always on and the load a few minutes a day), the small RDS instance, S3 storage, CloudFront traffic, Bedrock tokens (only when the topics are reclassified) and CloudWatch logs. The largest items are RDS and the always-on API; the load and the LLM weigh little. The amount is estimated with the AWS pricing calculator, using the client's region and access volume.

## If usage grows

1. **More visits:** CloudFront also starts caching the API answers, with the load version in the address, and the ALB balances across more API tasks.
2. **Shared cache:** with many API tasks, a managed Redis (ElastiCache) avoids each one redoing the same queries.
3. **More reads on the database:** an RDS read replica.
4. **Much more data** (several countries, years of history): the analytical base moves to a columnar warehouse (Redshift or Athena over S3), keeping the same definitions and tests.
