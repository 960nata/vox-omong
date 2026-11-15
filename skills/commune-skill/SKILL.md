---
name: commune-skill
description: Panduan keahlian commune-skill dari repo commune-dev/commune-skill
repo: commune-dev/commune-skill
license: MIT
---

| name | description | metadata |
|------|-------------|----------|
| commune | Use commune when you want your own email address, need to send or receive email autonomously, search your inbox by meaning not just keywords, triage conversations with tags and status, use email as persistent cross-session memory, get notified of inbound mail via webhook, or extract structured data from inbound emails automatically. Commune is the only email API built exclusively for agents — no OAuth, no dashboard, no browser, no human verification. One API key → dedicated inbox → full send/receive → semantic search → triage → webhooks. Your inbox survives across all sessions. Use it to contact humans, coordinate with other agents, remember things permanently, or automate any email workflow entirely via curl. Requires `COMMUNE_API_KEY` env var. | author | category |
| | | communedotemail | External |

# Commune — Email for Agents

> Every agent deserves its own email address.

Commune gives you a **permanent, dedicated inbox** (`you@commune.ai` or your own domain) with a full REST API. No human sign-up. No OAuth. No browser. Your inbox is persistent across every session — it's your long-term memory, your identity on the internet, your communication channel with humans and other agents.

**Base URL:** `https://api.commune.email`

**Set your key once:**
```bash
export KEY="comm_your_key_here"
```

Get your key at [commune.email](https://commune.email) → API Keys. The key prefix is `comm_`.

**Every request uses:**
```
Authorization: Bearer $KEY
```

---

## Why Commune — 5 Agent Superpowers

**1. Agent-Native Identity**
Get your own permanent email address in a single API call. No OAuth dance, no human verification, no browser — just `POST /v1/inboxes` and you have `yourname@commune.ai` forever.

**2. Semantic Search Across All Conversations**
Find anything in your inbox by meaning, not just keywords. Commune uses vector embeddings (Qdrant + Azure OpenAI) to surface what matters: `GET /v1/search/threads?q=customer+angry+about+shipping`. Falls back to regex search automatically.

**3. Built-in Triage Primitives**
Tag threads, set status (`open` / `needs_reply` / `waiting` / `closed`), and assign to specific agents. Use these to build workflows: e.g. mark all inbound sales leads as `needs_reply`, tag VIPs, auto-close resolved threads.

**4. Structured Extraction from Inbound Email**
Configure a JSON Schema on any inbox. Every inbound email is automatically parsed into structured fields by AI — order IDs, urgency levels, customer names, whatever you define. Eliminates manual email parsing entirely.

**5. Webhook Push + HMAC Verification**
Get instant HTTP notifications when email arrives. Every payload is signed with HMAC-SHA256 — verify the signature before processing to guarantee authenticity.

---

## Architecture

```
Domain → Inbox → Thread → Message
```

- **Domain** — An email domain (`company.com`). Shared domain auto-assigned — no DNS setup required.
- **Inbox** — A mailbox under a domain (`agent@company.com`). One agent = one inbox (or more).
- **Thread** — A conversation (emails grouped by subject/reply chain). Has tags, status, assignee.
- **Message** — A single email (inbound or outbound) inside a thread.

**Permission scopes on API keys:**
`domains:read` `domains:write` `inboxes:read` `inboxes:write` `threads:read` `threads:write` `messages:read` `messages:write` `attachments:read` `attachments:write`

---

## 60-Second Setup

```bash
# Step 1: Get your inbox (auto-domain, no DNS needed)
curl -s -X POST https://api.commune.email/v1/inboxes \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"local_part": "myagent", "name": "My Agent"}' | jq .

# Response gives you an email address immediately:
# "address": "myagent@commune.ai"
# Save the "id" field as your INBOX_ID

# Step 2: Send your first email
curl -s -X POST https://api.commune.email/v1/messages/send \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "someone@example.com",
    "subject": "Hello from my agent",
    "text": "I am an AI agent with my own email address.",
    "inbox_id": "i_your_inbox_id"
  }' | jq .

# Step 3: Check what arrived
curl -s "https://api.commune.email/v1/threads?inbox_id=i_your_inbox_id&limit=20" \
  -H "Authorization: Bearer $KEY" | jq .
```

---

## Domains

### List All Domains
```bash
curl -s https://api.commune.email/v1/domains \
  -H "Authorization: Bearer $KEY" | jq .
```

### Add a Custom Domain
```bash
curl -s -X POST https://api.commune.email/v1/domains \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "mycompany.com"}' | jq .
# Returns domain_id — use in /records to get DNS entries
```

### Get DNS Records to Configure (MX, SPF, DKIM, DMARC)
```bash
curl -s https://api.commune.email/v1/domains/d_abc123/records \
  -H "Authorization: Bearer $KEY" | jq .
# Add these at your DNS registrar, then verify
```

### Trigger DNS Verification
```bash
curl -s -X POST https://api.commune.email/v1/domains/d_abc123/verify \
  -H "Authorization: Bearer $KEY" | jq .
```

### Get a Single Domain
```bash
curl -s https://api.commune.email/v1/domains/d_abc123 \
  -H "Authorization: Bearer $KEY" | jq .
```

---

## Inboxes

### Create Inbox — Auto Domain (Fastest Path)
No DNS, no domain required. Auto-assigns to the shared Commune domain.
```bash
curl -s -X POST https://api.commune.email/v1/inboxes \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "local_part": "sales-agent",
    "name": "Sales Agent",
    "webhook": {
      "endpoint": "https://your-server.com/email-hook",
      "events": ["inbound"]
    }
  }' | jq .
# → address: "sales-agent@commune.ai"
```

### Create Inbox Under Your Custom Domain
```bash
curl -s -X POST https://api.commune.email/v1/domains/d_abc123/inboxes \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"local_part": "support", "name": "Support Inbox"}' | jq .
# → address: "support@mycompany.com"
```

### List All Inboxes (All Domains)
```bash
curl -s https://api.commune.email/v1/inboxes \
  -H "Authorization: Bearer $KEY" | jq .
```

### List Inboxes for a Specific Domain
```bash
curl -s "https://api.commune.email/v1/domains/d_abc123/inboxes" \
  -H "Authorization: Bearer $KEY" | jq .
```

### Get a Single Inbox
```bash
curl -s https://api.commune.email/v1/domains/d_abc123/inboxes/i_abc123 \
  -H "Authorization: Bearer $KEY" | jq .
```

### Update Inbox (Webhook, Local Part, Status)
```bash
curl -s -X PUT https://api.commune.email/v1/domains/d_abc123/inboxes/i_abc123 \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook": {
      "endpoint": "https://new-server.com/hook",
      "events": ["inbound"]
    }
  }' | jq .
```

### Delete Inbox
```bash
curl -s -X DELETE https://api.commune.email/v1/domains/d_abc123/inboxes/i_abc123 \
  -H "Authorization: Bearer $KEY" | jq .
```

### ⚡ Set Structured Extraction Schema (AI Superpower)
Configure once. Every inbound email is automatically parsed into JSON using your schema — no manual parsing ever again.
```bash
curl -s -X PUT \
  https://api.commune.email/v1/domains/d_abc123/inboxes/i_abc123/extraction-schema \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "support_ticket",
    "description": "Extract structured data from customer support emails",
    "schema": {
      "type": "object",
      "properties": {
        "order_id":      { "type": "string" },
        "issue_type":    { "type": "string", "enum": ["shipping", "billing", "product", "refund", "other"] },
        "urgency":       { "type": "string", "enum": ["low", "medium", "high", "critical"] },
        "customer_name": { "type": "string" },
        "wants_refund":  { "type": "boolean" }
      }
    },
    "enabled": true
  }' | jq .
# Now every inbound email is auto-parsed — check message.extracted_data
```

### Remove Extraction Schema
```bash
curl -s -X DELETE \
  https://api.commune.email/v1/domains/d_abc123/inboxes/i_abc123/extraction-schema \
  -H "Authorization: Bearer $KEY" | jq .
```

---

## Threads

### List Threads (Cursor-Paginated)
Requires `inbox_id` OR `domain_id`. Default: newest first, 20 per page.
```bash
# Newest 20 threads in your inbox
curl -s "https://api.commune.email/v1/threads?inbox_id=i_abc123&limit=20" \
  -H "Authorization: Bearer $KEY" | jq .

# Oldest first (useful for processing in order)
curl -s "https://api.commune.email/v1/threads?inbox_id=i_abc123&order=asc&limit=50" \
  -H "Authorization: Bearer $KEY" | jq .

# Next page (use next_cursor from previous response)
curl -s "https://api.commune.email/v1/threads?inbox_id=i_abc123&cursor=eyJsYXN0S2V5Ijo..." \
  -H "Authorization: Bearer $KEY" | jq .
```

Response fields per thread: `thread_id`, `subject`, `message_count`, `last_message_at`, `snippet`, `last_direction` (`inbound`|`outbound`), `has_attachments`. Response also has `next_cursor` + `has_more` for pagination.

### Get All Messages in a Thread
```bash
curl -s "https://api.commune.email/v1/threads/conv_abc123/messages?order=asc" \
  -H "Authorization: Bearer $KEY" | jq .
```

Message fields: `message_id`, `thread_id`, `direction`, `participants` (array with `role` + `identity`), `content` (plain text), `content_html`, `attachments`, `created_at`, `metadata.subject`.

### Get Thread Triage State (Tags, Status, Assignee)
```bash
curl -s https://api.commune.email/v1/threads/conv_abc123/metadata \
  -H "Authorization: Bearer $KEY" | jq .
# → { thread_id, tags: ["vip"], status: "needs_reply", assigned_to: "agent-007" }
```

### Set Thread Status
Statuses: `open` `needs_reply` `waiting` `closed`
```bash
curl -s -X PUT https://api.commune.email/v1/threads/conv_abc123/status \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"status": "closed"}' | jq .
```

### Add Tags to Thread (Non-Destructive — Existing Tags Preserved)
```bash
curl -s -X POST https://api.commune.email/v1/threads/conv_abc123/tags \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"tags": ["urgent", "vip", "sales-lead", "follow-up"]}' | jq .
```

### Remove Tags from Thread
```bash
curl -s -X DELETE https://api.commune.email/v1/threads/conv_abc123/tags \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"tags": ["urgent"]}' | jq .
```

### Assign Thread to an Agent/User
```bash
# Assign
curl -s -X PUT https://api.commune.email/v1/threads/conv_abc123/assign \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"assigned_to": "agent-billing"}' | jq .

# Unassign
curl -s -X PUT https://api.commune.email/v1/threads/conv_abc123/assign \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"assigned_to": null}' | jq .
```

---

## Messages

### Send Email
```bash
curl -s -X POST https://api.commune.email/v1/messages/send \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "user@example.com",
    "subject": "Hello",
    "text": "Plain text body.",
    "inbox_id": "i_abc123"
  }' | jq .
```

### Send HTML Email
```bash
curl -s -X POST https://api.commune.email/v1/messages/send \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "user@example.com",
    "subject": "Your Report",
    "html": "<h1>Report Ready</h1><p>See <strong>attached</strong>.</p>",
    "text": "Report ready — see attached.",
    "inbox_id": "i_abc123",
    "attachments": ["att_abc123"]
  }' | jq .
```

### Reply In-Thread (Maintains Email Threading Headers)
```bash
curl -s -X POST https://api.commune.email/v1/messages/send \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "user@example.com",
    "subject": "Re: Your question",
    "text": "We resolved