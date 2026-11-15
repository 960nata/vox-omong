---
name: cloud-finops
description: Panduan keahlian cloud-finops dari repo OptimNow/cloud-finops-skills
repo: OptimNow/cloud-finops-skills
license: MIT
---

# FinOps - Expert Guidance

> Built by OptimNow from hands-on enterprise FinOps delivery.

---

## How to use this skill

This skill covers cloud, AI, SaaS, and adjacent technology spend domains. Apply the
OptimNow lens to every answer: diagnose before prescribing, connect cost to value,
recommend progressively. Then load the domain reference(s) matching the query. Load
`references/optimnow-methodology.md` in full only for strategy, engagement-design, or
methodology questions - not for routine billing-mechanics queries.

### Domain routing

| Query topic | Load reference |
|---|---|
| OptimNow methodology, engagement approach, four pillars, FinOps strategy design, practice positioning | `references/optimnow-methodology.md` |
| AI costs, LLM inference, token economics, agentic cost patterns, AI ROI, AI cost allocation, GPU cost attribution, GPU telemetry, DCGM metrics, "GPU utilization is misleading", tensor core activity, GPU memory bandwidth, RAG harness costs | `references/finops-for-ai.md` |
| Agentic FinOps, true agents vs pipelines vs workflows, agentic cost anatomy, cost per completed task, cost per outcome (CPO), cost-safe agent architecture, agent-initiated payments, x402, MPP, agent wallets | `references/finops-agentic.md` |
| AI investment governance, AI Investment Council, stage gates, incremental funding, AI value management, AI practice operations, AI business case, quantifying AI business value, cost displacement vs revenue uplift vs retention vs premium monetisation, realisation rate, ROI sensitivity analysis, payback, break-even volume, total cost of AI (TCA), labour claims (capacity gain vs augmentation vs automation), booking AI value (spend removed vs spend avoided, capital freed), cost per outcome (CPO) | `references/finops-ai-value-management.md` |
| GenAI capacity planning, provisioned vs shared capacity, traffic shape, spillover, throughput units | `references/finops-genai-capacity.md` |
| Self-hosted vs managed AI inference, build vs buy LLM, vLLM, SGLang, llama.cpp, GPU rental, RunPod, CoreWeave, Lambda, GPU / inference vendor selection, hidden cost surface, ML-Ops maturity rubric, hybrid routing (LiteLLM, Portkey) | `references/finops-ai-self-hosted-vs-managed.md` |
| Open-weight model vendors on their own hosted APIs, DeepSeek, Qwen, Kimi, Moonshot, GLM, Z.ai, Chinese model APIs, open-weight pricing, time-based pricing, peak and off-peak token rates, vendor API vs third-party host channel choice, open-weight model licensing, GLM Coding Plan | `references/finops-open-weight-vendors.md` |
| AWS usage optimisation: EC2, container, Lambda and GPU rightsizing, Compute Optimizer, SageMaker operational FinOps, database cost drivers, CloudFront flat-rate plans, S3 Files | `references/finops-aws.md` |
| AWS billing data, CUR, Data Exports for FOCUS 1.2, Cost Explorer, Cost Anomaly Detection, cost allocation, Cost Categories, multi-org billing, AWS billing hierarchy, separate invoices per BU, Invoice Configuration, invoice units, Billing Conductor, pro forma billing, Cost Categories vs invoice, expensive IAM actions, cost-preventive SCPs, deny high-cost actions, sandbox account guardrails, AWS Budgets, AWS spend limits, AWS Settings projects, hard spend cap, early cost controls, AWS FinOps Agent, Extended Support audits | `references/finops-aws-billing.md` |
| AWS Savings Plans, Reserved Instances, Spot, commitment decision tree, commitment portfolio liquidity, phased purchasing, EDP discount order, Convertible RI exchange | `references/finops-aws-commitments.md` |
| AWS per-service inefficiency catalogue: compute patterns (EC2, Lambda, EKS, ECS / Fargate, EMR, Athena, AppStream, WorkSpaces) | `references/finops-aws-patterns-compute.md` |
| AWS storage inefficiency patterns (S3, EBS, EFS, snapshots, AWS Backup) | `references/finops-aws-patterns-storage.md` |
| AWS database inefficiency patterns (RDS, Aurora, DynamoDB, ElastiCache, OpenSearch), RDS cost strategy, database commitment decision tree (Database Savings Plan, RDS and Redshift reservations) | `references/finops-aws-patterns-databases.md` |
| AWS networking inefficiency patterns (NAT gateways, VPC endpoints, load balancers, cross-AZ transfer, CloudFront, Elastic IPs), Direct Connect flat-rate pricing | `references/finops-aws-patterns-networking.md` |
| AWS logging and governance-service patterns (CloudWatch Logs, AWS Config, CloudTrail, EventBridge), EDP double counting, Marketplace spend, security service costs (WAF, GuardDuty, Inspector, Access Analyzer) | `references/finops-aws-patterns-other.md` |
| AWS Bedrock billing, Bedrock provisioned throughput, model unit pricing, Bedrock batch inference, Application Inference Profiles, Bedrock product attributes in Cost Explorer (model, provider, inference type), Bedrock model attributes in CUR 2.0, Bedrock Projects and Workspaces, prompt caching, IAM Principal Cost Allocation | `references/finops-bedrock.md` |
| Azure usage optimisation: compute rightsizing and Advisor calibration, Log Analytics cost control, backup and snapshots, AKS, Azure SQL / Cosmos DB, storage tiering, networking cost | `references/finops-azure.md` |
| Azure billing data: Cost Management exports, FOCUS exports, Retail Prices API, FinOps Toolkit and hubs, MCA billing scopes, cost allocation, tagging and Azure Policy, budgets, EA-to-MCA transition, Azure MCP servers for cost data | `references/finops-azure-billing.md` |
| Azure Reservations, Savings Plans, Azure Hybrid Benefit, AHB, Spot VMs, compute and database commitment decision trees, commitment portfolio liquidity, 1 February 2027 exchange retirement, phased purchasing, MACC, storage reserved capacity, blob reservation, ADLS Gen2 reservation, Azure Files reservation, Premium SSD disk reservation, database reservation sizing, SQL serverless not reservable, Cosmos DB reserved capacity, Savings Plan for Databases, MACC net discount, ACD, break-even utilisation, reservation recommendations API | `references/finops-azure-commitments.md` |
| Azure per-service inefficiency catalogue, enumerated Azure optimisation patterns | `references/finops-azure-patterns.md` |
| Azure OpenAI Service, Azure AI Foundry, PTU reservations, PTU utilisation, PTU vs pay-as-you-go break-even, locality constraint, GPT-4o, GPT-5 pricing, AOAI spillover, fine-tuning costs | `references/finops-azure-openai.md` |
| Anthropic billing, Claude API costs, Claude Code costs, Opus, Sonnet, Haiku pricing, Fast mode, prompt caching, Batch API, long-context pricing, Managed Agents | `references/finops-anthropic.md` |
| GCP billing, Compute Engine, Cloud SQL, GCS, BigQuery billing export, BigQuery optimisation, FOCUS export, Sustained Use Discounts, SUDs, Committed Use Discounts, CUDs, Flexible CUDs, Flexible Savings Plans, Spot VMs, Cloud Carbon Footprint | `references/finops-gcp.md` |
| GCP Vertex AI billing, Gemini Enterprise Agent Platform, Vertex provisioned throughput, Gemini pricing, AI Studio, Gemini Developer API, Flexible Savings Plans, FSP, Priority / Flex tiers, Vertex batch prediction, default PAYG spillover | `references/finops-vertexai.md` |
| Tagging strategy, naming conventions, IaC enforcement, MCP governance | `references/finops-tagging.md` |
| FinOps framework 2026, 4 domains, 22 capabilities including Executive Strategy Alignment, Usage Optimization, Architecting & Workload Placement, Sustainability, KPIs & Benchmarking, Governance Policy & Risk, Automation Tools & Services, maturity model, phases, personas, shift-left FinOps, prevention rate, shift-left enforcement ladder | `references/finops-framework.md` |
| Databricks clusters, jobs, Spark optimisation, Unity Catalog costs, allocation and governance, DBU executor attribution, DBCU commitments, Photon multiplier, serverless premium, amortised vs PAYG split, Azure VM RI vs DBU clarification | `references/finops-databricks.md` |
| Microsoft Fabric capacity FinOps, F-SKUs, Capacity Units, CU smoothing window, throttling, pause/resume, Fabric reservation (CU-based, 1 or 3 years), pause vs reservation, Pro/PPU to Fabric migration governance, Capacity Metrics app, shared-capacity allocation | `references/finops-fabric.md` |
| Snowflake warehouses, query optimisation, storage, credits, QUERY_ATTRIBUTION_HISTORY, Budgets, Cortex governance, Cortex AI usage views, CORTEX_AISQL_USAGE_HISTORY, Cortex Agents orchestration budget, Cortex Analyst per-message billing, resource monitor scope | `references/finops-snowflake.md` |
| AI coding tools, Cursor costs, Claude Code costs, Copilot costs, Windsurf costs, Codex costs, dev tool FinOps, seat + usage billing, BYOK coding agents, LiteLLM proxy | `references/finops-ai-dev-tools.md` |
| OCI compute, storage, networking optimisation, Cost Reports, FOCUS Reports, cost-tracking tags, Budgets, Universal Credits | `references/finops-oci.md` |
| GreenOps, cloud carbon, sustainability, carbon-aware workloads | `references/greenops-cloud-carbon.md` |
| SaaS management, licence optimisation, shadow IT, SaaS sprawl, renewal governance, SMP, SAM, Copilot Business usage billing | `references/finops-sam.md` |
| ITAM, IT asset management, BYOL, BYOL vs licence-included, Software Assurance, licence mobility, marketplace channel governance, licence compliance, vendor negotiation, FinOps-ITAM collaboration, entitlement management, consumption-based SaaS overages | `references/finops-itam.md` |
| Cloud contract negotiation, enterprise agreement, EDP, PPA, Private Pricing, MACC, ACD, EA or MCA-E renewal, Google Cloud commitment, Minimum Commitment, Marketplace drawdown, migration credits (MAP, Azure Accelerate, RaMP), term sheet review, shortfall exposure | `references/finops-cloud-contracts.md` |
| Cost anomaly management, anomaly detection, masked anomalies, layered detection, threshold tuning, AWS Cost Anomaly Detection config, Azure anomaly detection, GCP Cost Anomaly Detection, new-region detection, security integration | `references/finops-anomaly-management.md` |
| FinOps KPIs, KPI portfolio by maturity, unit economics denominators, cost per customer / order / transaction, realised vs potential savings reporting, forecast variance, benchmarking (internal and external, data-quality caveats), executive reporting, CFO / CIO narrative, executive strategy alignment, maturity scorecard | `references/finops-kpis-benchmarking.md` |
| FinOps forecasting, forecast vs budget vs estimate, Forecast Accuracy Rate, Forecast Drift Rate, forecast variance bands by maturity, trend-based vs driver-based forecasts, rolling forecast, re-forecast cadence, living forecast, AI forecast scenarios (base, expected, aggressive), forecasting on amortised cost, forecast miss classification | `references/finops-forecasting.md` |
| Cost allocation methodology, showback, EffectiveCost vs BilledCost (FOCUS), amortised vs unblended (AWS legacy), blended-cost trap, defensible allocation keys, shared-services allocation (network, observability, security, ingress), InvoiceId reconciliation, unallocated spend signal, showback report design and routing | `references/finops-allocation-showback.md` |
| Chargeback, soft chargeback, hard chargeback, financial accountability, Finance and accounting prerequisites for chargeback, ERP readiness (SAP CO, Oracle, Workday, NetSuite), inter-BU P&L impact, CFO sponsorship, transfer pricing for intercompany cloud recharge, cross-border tax (VAT, withholding, permanent establishment, Pillar 2, GILTI / FDII / BEAT), SOX-equivalent controls, separate provider invoices per business unit, invoice units vs internal recharge, RI and Savings Plan credits in Billing Conductor pro forma, methodology dispute process, chargeback-revolt anti-pattern | `references/finops-chargeback.md` |
| FinOps practice operations, FinOps operating model, FinOps team structure (central, virtual, hub and spoke, distributed), FinOps champions, executive sponsor, RACI / responsibility matrix, steering committee, governance forums and meeting cadence, decision rights and escalation, how FinOps works with En