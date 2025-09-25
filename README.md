# Serverless URL Shortener with Analytics

A scalable Bit.ly clone built on **AWS Serverless** architecture using **API Gateway, Lambda, DynamoDB, and CDK**.  
Supports short link generation, redirection, click tracking, and analytics (referrer + user-agent insights).

---

## 🚀 Features

- **POST /links** → Create short links (validates input, generates base62 IDs with `nanoid`, stores in DynamoDB).
- **GET /{id}** → Redirect to the original URL (301 redirect) and log click event (timestamp, referrer, user-agent).
- **GET /links/{id}/stats** → Fetch analytics (total clicks, last 5 referrers, last 5 user agents).
- **Serverless-first**: scales automatically, costs **$0 when idle**.
- **Analytics TTL**: click logs auto-expire after 30 days using DynamoDB TTL.
- **Least-privilege IAM**:
  - Create Lambda → read/write URLs table
  - Redirect Lambda → read-only URLs table, write-only clicks table
  - Stats Lambda → read-only clicks table

---

## 🛠️ Tech Stack

- **AWS CDK (TypeScript)** → Infrastructure as Code
- **API Gateway** → REST API endpoints
- **AWS Lambda** → Business logic (Node.js 20.x)
- **DynamoDB** → Persistent storage (on-demand billing, $0 idle)
- **CloudWatch Logs** → Function logging (7-day retention)
- **nanoid** → Generates short, collision-resistant IDs

---

## 📐 Architecture

```text
   Client
     │
     ▼
 ┌──────────┐    ┌─────────────┐
 │ API GW   │───▶│ Create Fn   │───▶ DynamoDB (UrlsTable)
 │ (REST)   │    └─────────────┘
 │          │
 │          │───▶│ Redirect Fn │───▶ DynamoDB (UrlsTable → get originalUrl)
 │          │    └─────────────┘
 │          │                 │
 │          │                 ▼
 │          │             DynamoDB (ClicksTable)
 │          │
 │          │───▶│ Stats Fn   │───▶ DynamoDB (ClicksTable → query stats)
 └──────────┘    └─────────────┘
📊 Example Usage
1) Create Short Link
http
Copy code
POST /links
Content-Type: application/json

{
  "url": "https://www.example.com"
}
Response:

json
Copy code
{
  "id": "aZ3K9pQ",
  "shortUrl": "https://{api-domain}/aZ3K9pQ",
  "originalUrl": "https://www.example.com"
}
2) Redirect
http
Copy code
GET /aZ3K9pQ
Response: 301 Moved Permanently → Location: https://www.example.com

3) Stats
http
Copy code
GET /links/aZ3K9pQ/stats
Response:

json
Copy code
{
  "id": "aZ3K9pQ",
  "totalClicks": 12,
  "recentReferrers": ["https://twitter.com", "unknown", "https://linkedin.com"],
  "recentUserAgents": [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"
  ]
}
⚡ Cost Controls
DynamoDB on-demand billing ($0 idle).

TTL for click events (auto-deletes after 30 days).

Logs expire after 7 days.

cdk destroy removes all resources.

📂 Project Structure
pgsql
Copy code
.
├── bin/                         # CDK app entry
├── lib/                         # CDK stack (infra as code)
├── src/
│   └── functions/
│       ├── create/              # POST /links
│       ├── redirect/            # GET /{id}
│       └── stats/               # GET /links/{id}/stats
├── package.json
├── cdk.json
└── tsconfig.json
🎤 Interview Talking Points
Why DynamoDB? → Key-value access pattern, on-demand billing, $0 idle.

Scalability? → Lambda + API Gateway scale automatically with traffic.

Analytics design? → Logged each click separately (id, timestamp, referrer, user-agent), TTL for auto-cleanup, stats endpoint queries efficiently.

Security? → Least-privilege IAM roles per Lambda.

Infra as Code? → CDK ensures reproducibility, cdk synth = blueprint, cdk deploy = live infra, cdk destroy = cleanup.

🏆 Why This Project Matters
This project demonstrates backend + cloud skills:

Serverless architecture (API GW, Lambda, DynamoDB)

Infrastructure as Code (AWS CDK)

Observability + Analytics (click logging, TTL, stats endpoint)

Cost optimization (on-demand billing, log retention, TTL)

Perfect for showcasing cloud engineering + software engineering skills in internship/job applications.
```
