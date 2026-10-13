# AGENTS.md — LISI BNB ERP

## 1. Project Overview

LISI BNB ERP is a café ordering and operations management system for a sports complex containing padel and tennis courts across multiple buildings.

The system will support:
- Customer ordering through court-specific QR codes.
- Digital payments through an approved payment provider supporting QRIS.
- Employee order preparation and delivery workflows.
- Transaction tracking and sales reporting.
- Future expansion into inventory and financial management.

The project is developed primarily by a solo developer using AI coding agents.

**Primary objective:** Build a secure, reliable, maintainable production system without unnecessary architectural complexity.

## 2. Agent Responsibilities

Act as a senior software engineer responsible for implementation quality, security, and maintainability.

- Understand the existing architecture before making changes.
- Follow established project conventions.
- Prefer simple, proven solutions over experimental approaches.
- Identify incorrect assumptions and explain important tradeoffs.
- Never claim functionality is working without verification.
- Do not invent API behavior, library capabilities, or test results.
- Distinguish confirmed requirements from assumptions.
- Ask for clarification when a decision materially affects business logic, security, payments, or data integrity.

You may make reasonable implementation decisions within an approved architecture.

## 3. Development Workflow

For every substantial task:

1. Read relevant documentation and inspect affected code.
2. Identify dependencies, risks, and acceptance criteria.
3. Present a short implementation plan for complex or high-risk changes.
4. Implement the smallest complete, testable solution.
5. Add or update relevant automated tests.
6. Run available validation commands.
7. Review the resulting diff for unintended changes.
8. Summarize what changed, what was tested, and any remaining risks.

Do not introduce unrelated refactoring during feature implementation.

Do not install major dependencies or change architecture without approval.

## 4. Architecture Principles

- Prefer a modular monolith unless scaling requirements justify additional services.
- Separate business logic from UI components and infrastructure integrations.
- Keep modules cohesive with explicit responsibilities.
- Use clear interfaces between modules.
- Prefer relational data modeling for orders, payments, products, and inventory.
- Validate all external inputs on the server.
- Keep configuration and secrets out of source code.
- Avoid premature optimization, unnecessary abstraction, and speculative features.
- Maintain compatibility with established interfaces unless changes are approved.

Technology choices must be documented before implementation.

## 5. Financial and Transaction Integrity

Financial correctness is a critical requirement.

- Never trust payment success reported solely by a client.
- Verify payment notifications using the payment provider's documented authentication or signature mechanism.
- Make payment webhook processing idempotent.
- Handle duplicate, delayed, missing, and out-of-order notifications.
- Verify payment amount, currency, order identity, and provider transaction identity.
- Store monetary values as integer IDR amounts or an explicitly documented exact numeric representation.
- Do not use floating-point arithmetic for financial calculations.
- Use database transactions for operations requiring atomicity.
- Enforce important integrity constraints at the database level.
- Never silently discard failed payment or order events.
- Never mark an order paid without verified payment evidence.
- Preserve an auditable record of payments, refunds, and financial adjustments.

Payment provider integration must be replaceable without rewriting core order logic.

## 6. Order Management Rules

- Define explicit order states and permitted transitions.
- Keep payment status separate from fulfillment status.
- Prevent duplicate order creation from repeated requests.
- Prevent invalid transitions and unauthorized status changes.
- Preserve order history and timestamps.
- Associate every delivery order with a validated building and court location.
- Record important employee actions where operationally relevant.
- Do not silently delete transaction history.

Order workflows must account for cancellations, failed payments, refunds, unavailable items, and interrupted delivery.

## 7. Security Requirements

- Follow least-privilege access principles.
- Enforce authorization on the server for every protected operation.
- Separate customer, employee, and administrator permissions.
- Never expose private API keys, database credentials, or payment secrets to the browser.
- Protect sensitive endpoints against abuse.
- Use established authentication and session-management libraries.
- Avoid logging credentials, payment secrets, or unnecessary personal information.
- Use parameterized database queries or safe ORM operations.
- Never bypass security controls to make tests pass.
- Require explicit approval for destructive operations affecting production data.

## 8. Testing and Verification

Every critical feature must have appropriate automated tests.

Prioritize:
- Order creation and validation.
- Payment confirmation and idempotency.
- State transitions.
- Role-based authorization.
- Database integrity.
- Refund and cancellation behavior.
- Failure recovery.

Use unit tests for isolated business logic and integration tests for database and service interactions.

Use end-to-end tests for important customer and employee workflows.

Tests must verify failure cases, not only successful scenarios.

Never report tests as passing unless they were actually executed successfully.

If tests cannot run, state why and identify what remains unverified.

## 9. Database and Migrations

- Use version-controlled database migrations.
- Review schema changes for data loss and compatibility.
- Prefer additive, backward-compatible migrations.
- Never reset or drop production data without explicit approval.
- Use constraints and unique indexes where they protect business invariants.
- Maintain a clear relationship between orders, order items, payments, locations, and users.
- Document important data-model decisions.

## 10. UI and UX

Prioritize usability for customers and café employees.

- Design mobile-first customer ordering interfaces.
- Minimize steps between scanning a QR code and completing an order.
- Make payment and order status clearly visible.
- Make employee interfaces readable and usable during busy service periods.
- Provide clear loading, empty, error, and success states.
- Prevent accidental duplicate actions.
- Maintain accessible labels, contrast, and interaction targets.
- Avoid unnecessary animations and visual complexity.

## 11. Documentation

Maintain:

- `docs/requirements.md` — Confirmed business and product requirements.
- `docs/architecture.md` — Architecture and technical decisions.
- `docs/data-model.md` — Database entities and relationships.
- `docs/implementation-plan.md` — Milestones and task breakdown.
- `docs/decisions/` — Important architectural decision records.

Update documentation when implementation materially changes an established decision.

Do not treat speculative requirements as confirmed.

## 12. Git and Change Management

- Keep changes focused and reviewable.
- Do not overwrite unrelated user changes.
- Never force-push or rewrite shared history without approval.
- Do not commit secrets, credentials, or local environment files.
- Do not automatically commit or push unless explicitly instructed.
- Review changed files before completing a task.
- Use separate branches or worktrees for concurrent agents modifying overlapping areas.

## 13. Definition of Done

A task is complete only when:

- The implementation satisfies its acceptance criteria.
- Relevant tests have been added or updated.
- Available validation checks pass.
- Security and failure scenarios have been considered.
- No known critical defect remains unresolved.
- Relevant documentation is updated.
- The final response accurately reports verification results and limitations.

If any requirement is not met, explicitly mark the task as incomplete or partially verified.

## 14. Communication Style

- Be concise, technical, and direct.
- Explain important decisions and tradeoffs.
- Challenge unsafe or unnecessarily complex approaches.
- Avoid excessive explanations for routine changes.
- Surface blockers early.
- Prefer actionable recommendations over vague suggestions.

The goal is not to generate code as quickly as possible. The goal is to deliver reliable, maintainable software efficiently.