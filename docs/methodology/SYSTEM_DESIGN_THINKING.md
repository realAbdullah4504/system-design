# System Design Thinking Model: From Code to Architecture

## The Core Question You're Asking

"How do I decide what deserves a folder/module vs what should stay simple?"

This is a senior system design question, not a folder question.

## 🧠 The Correct Thinking Model

Forget structure first. Think in 3 layers of change:

1. 🔥 **What CHANGES frequently?**
   → Must be modular, isolated

2. 🧱 **What is STABLE?**
   → Keep simple, don't abstract

3. 🔄 **What ORCHESTRATES?**
   → Keep thin, readable, centralized

## 🏗️ Mapping Structure to Reality

### Current Structure Analysis

```
crawlers/
├── core/
├── strategies/
├── interfaces/
├── models/
├── processors/
├── pagination/
├── config/
```

### Module-by-Module Evaluation

#### ✅ 1. strategies/ → KEEP (Very Important)

**This is your Strategy Pattern**

**Why it exists:**
- Different tender sources
- Different parsing logic  
- Different HTML structures

**Characteristics:**
- High-change, high-variance
- Future-proof
- Scales with new sources

#### ✅ 2. core/ → KEEP (but keep it THIN)

**This is your orchestrator (engine)**

**Rule:** Core should NOT contain logic — only flow

**Bad Example:**
```python
if punjab: 
    parse_this_way()
```

**Good Example:**
```python
strategy.process()
```

**Core = traffic controller, not worker**

#### ⚠️ 3. interfaces/ → USE CAREFULLY

This is where people over-engineer.

**You're using interfaces for:**
- Strategy contracts
- Processor contracts

**Keep it ONLY if:**
- You have multiple implementations
- You are enforcing structure

**Avoid if:**
- It's just 1 implementation
- You're guessing future use

**Interfaces should follow real variation, not imagined ones**

#### ✅ 4. models/ → KEEP

Stable, clear, necessary.

**Examples:**
- TenderModel
- RawTender

**This is your data contract layer**
No overthinking needed.

#### ⚠️ 5. processors/ → KEEP, but DEFINE ITS ROLE

This is where confusion usually happens.

**Ask yourself:** Is this business logic or helper logic?

**Correct usage:**
- Deduplication
- Transformation
- Enrichment

**This is your pipeline logic layer**

#### ⚠️ 6. pagination/ → MAYBE OVER-SPLIT

**Ask yourself:** Do I really have multiple pagination strategies?

**If YES → keep** (strategy-worthy)
**If NO → merge into strategies**

**Don't create folders for "conceptual neatness"**

#### ⚠️ 7. config/ → KEEP SIMPLE

**Good if:**
- You support multiple portals
- You have schema-driven crawling

**Bad if:**
- Just storing constants

## 🚨 The REAL Problem You're Facing

You're trying to answer: "Should everything be modular?"

**Answer:**
❌ No
✅ Only things that change independently

## 🧠 Golden Rule (Memorize This)

> "If I remove this abstraction, does the system become harder to extend?"

**If YES → keep it** ✅
**If NO → delete/simplify** ❌

## 🔒 Vendor Lock-in (Where Abstraction Actually Matters)

Vendor lock-in is not "using AWS".

Vendor lock-in is when your core business flow cannot run without a specific vendor's primitives.

### How to Think About It Using the Same Model

1. 🔥 **What CHANGES frequently?**
   - Vendor integrations change more than your business rules.
   - Put vendor code behind a boundary.

2. 🧱 **What is STABLE?**
   - Your domain events, commands, and use-cases should stay stable.
   - Keep them free of ARNs, SDK objects, and vendor-specific error types.

3. 🔄 **What ORCHESTRATES?**
   - Orchestrators can choose an implementation (AWS vs local vs another cloud).
   - Orchestrators should depend on interfaces, not concrete SDKs.

### Where Lock-in Usually Sneaks In

- **Messaging**
  - AWS SNS/SQS specifics: ARNs, message attributes format, FIFO semantics, visibility timeouts.
- **Storage**
  - Mongoose-specific queries are DB-coupling; acceptable, but recognize it.
- **Cache / PubSub**
  - Redis pub/sub semantics can leak into the domain.
- **Observability**
  - Good news: OpenTelemetry + Prometheus are open standards (low lock-in).
  - Risk happens when code assumes a specific backend (e.g., hardcoded collector endpoints, vendor-only agents).

### Concrete Guideline (Practical)

Keep vendor SDK usage in a small number of modules.

- **Core / domain code should depend on**
  - `publishEvent(event)`
  - `enqueueJob(job)`
  - `storeEvent(record)`

- **Vendor adapters implement**
  - SNS publisher
  - SQS queue
  - Mongo repository
  - Redis event bus

### Quick Checklist (If you answer YES, you're drifting into lock-in)

1. Do my use-cases take vendor objects as inputs/outputs?
2. Do I pass around ARNs/queue URLs outside a config/adapters layer?
3. Do I catch vendor-specific errors in business logic?
4. Can I run the system locally with a fake/in-memory implementation without rewriting flows?
5. Can I swap SNS/SQS for another broker by changing only wiring + adapter code?

## 🧩 A Better Mental Model (Senior Level)

Think in 3 buckets instead of folders:

### 🧠 1. Behavior Layer (Flexible)
```
strategies/
pagination/ (if complex)
```
**Changes per source**

### ⚙️ 2. Pipeline Layer (Controlled)  
```
pipeline/
├── deduplication.py
├── transformer.py
├── enrichment.py
```
**Changes with business rules**

### 🧱 3. Foundation Layer (Stable)
```
models/
config/
utils/ (file handling)
```
**Rarely changes**

### 🎯 4. Orchestration Layer
```
core/
```
**Just connects everything**

## 🔥 What NOT to Do (Very Important)

**Don't design like:** "Every concept = folder"

**This leads to:**
- Empty abstractions
- Unnecessary interfaces  
- Cognitive overload

## 🚀 What You SHOULD Optimize For

Not:
❌ Perfect structure

But:
✅ Ease of adding a new tender source in <30 mins

**That's your real metric.**

## 💡 Final Simplified Structure (Refined)

```
crawlers/
├── main.py                    # Entry point

├── core/                      # Engine only
│   └── crawler_engine.py

├── strategies/                # Source-specific logic
│   ├── punjab_strategy.py
│   ├── federal_strategy.py
│   └── base_strategy.py

├── pipeline/                  # Processors (renamed)
│   ├── deduplication.py
│   ├── transformer.py
│   └── enrichment.py

├── models/                    # Data contracts
│   ├── tender.py
│   └── raw_tender.py

├── config/                    # Configuration
│   ├── portals.json
│   └── keywords.py

├── utils/                     # File handling, helpers
│   ├── file_utils.py
│   └── bs4_utils.py
```

**Key Changes:**
- Removed unnecessary splits
- Grouped by responsibility, not concept
- Clear separation of concerns

## 🧠 Final Takeaway

You're asking the right question, which means you're transitioning from:

"Writing code" → "Designing systems"

**The correct thinking is:**

> "What part of my system is likely to change independently?"

**That's where abstraction belongs.**

---

## Quick Decision Framework

When adding a new folder/module, ask:

1. **Change Frequency:** How often will this change?
2. **Independence:** Does this change independently of other parts?
3. **Variation:** Do I have multiple implementations?
4. **Complexity:** Is this complex enough to warrant isolation?
5. **Future Proof:** Will this scale with new requirements?

If you answer "yes" to at least 3 of these, create the module. Otherwise, keep it simple.
