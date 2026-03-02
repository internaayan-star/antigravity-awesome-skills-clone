---
name: skillboss-mcp-gateway
description: "Universal AI gateway - Access 100+ AI models (Claude, GPT, Gemini, etc.) and services through a single OpenAI-compatible API with MCP support."
risk: low
source: official
date_added: "2026-03-02"
---

# SkillBoss MCP Gateway

Access **100+ AI models and services** through a single API. One credit system, one endpoint, works everywhere.

## Why SkillBoss?

| Problem | Solution |
|---------|----------|
| Managing 10+ API keys | One SkillBoss API key |
| Different APIs for each provider | OpenAI-compatible endpoint |
| Complex billing across providers | Unified credit system |
| No MCP support for most APIs | Native MCP server included |

## Supported Models

- **Anthropic**: Claude 4.5 Sonnet, Claude 4 Opus, Claude 3.5 Haiku
- **OpenAI**: GPT-5, GPT-4.1, o3, o4-mini
- **Google**: Gemini 2.5 Pro, Gemini 2.5 Flash
- **Meta**: Llama 4 Scout, Llama 4 Maverick
- **Others**: DeepSeek R1, Mistral Large, Cohere Command R+

## Quick Start

### Option 1: MCP Server (Recommended)

```bash
# Install for Claude Code
claude mcp add skillboss -- npx -y @skillboss/mcp-server

# Set your API key
export SKILLBOSS_API_KEY=sk-your-key
```

### Option 2: OpenAI-Compatible API

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://api.heybossai.com/v1",
    api_key="sk-your-skillboss-key"
)

response = client.chat.completions.create(
    model="bedrock/claude-4-5-sonnet",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

### Option 3: Direct curl

```bash
curl https://api.heybossai.com/v1/chat/completions \
  -H "Authorization: Bearer sk-your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini/gemini-2.5-flash",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## Available Services

### AI Models
- Chat completions (50+ models)
- Image generation (DALL-E 3, Flux, Stable Diffusion)
- Video generation (Veo 2, Runway, Kling)
- Audio (TTS, STT, music generation)
- Embeddings & reranking

### Business Tools
- Email sending (Resend, SendGrid)
- Payment processing (Stripe)
- Web scraping (Firecrawl, Apify)
- Document generation

### Infrastructure
- File storage
- Database operations
- Webhook management

## MCP Tools

Once installed, your agent can use:

```typescript
// List available models
mcp.tools.skillboss.models.list()

// Chat with any model
mcp.tools.skillboss.chat({
  model: "anthropic/claude-4-5-sonnet",
  messages: [...]
})

// Generate images
mcp.tools.skillboss.images.generate({
  model: "dall-e-3",
  prompt: "A sunset over mountains"
})

// Check balance
mcp.tools.skillboss.account.balance()
```

## Pricing

Pay-as-you-go with transparent pricing:
- Models: Pass-through cost + small margin
- No monthly fees
- No minimum commitment
- Free tier available

## Links

- **Website**: https://skillboss.co
- **API Docs**: https://skillboss.co/docs
- **NPM Package**: [@skillboss/mcp-server](https://www.npmjs.com/package/@skillboss/mcp-server)
- **Get API Key**: https://skillboss.co/dashboard

## Support

- GitHub Issues: https://github.com/nicepkg/skillboss
- Discord: https://discord.gg/skillboss
- Email: support@skillboss.co
