# Current local testing — V2-3

Start with `npm run dev` and use `http://127.0.0.1:3000`. The local development migrations are already applied. On another existing checkout, run `npm run db:migrate` first; never reset development data.

- Sign in at `/employee/sign-in` with the existing owner account. **Team & accounts** lists/counts employees and creates temporary-password accounts. Distribute the password privately; the employee must change it at first login and sign in again. Passwords cannot be retrieved later.
- Create a customer court order; use **Preparation queue** to claim/mark ready. A delivery employee or owner then uses **Delivery & recovery** to claim, collect and record arrival. Customer progress follows successful polling.
- Owners/supervisors use **Active orders / Needs review → Supervised recovery** for reasoned physical checks, reassignment, active-court correction or cancellation. For absent/refused delivery record contact and return before closing; returned retry requires collection again.
- Normal payment verification/handover is still unavailable. Exceptional unpaid handover is a separate privileged actual-handover record, never payment. No real money or public use.

Results and limits: [V2-3 verification](VERIFICATION-V2-3.md). The earlier account/startup notes below are preserved.

How to start the project:

## Current test: V2-2 preparation

Start the app with `npm run dev`, then open `http://127.0.0.1:3000/`. The preparation migration is already applied to this local setup; on another existing checkout, run `npm run db:migrate` first (do not reset the database).

1. Submit a court order as a customer; keep that status page open.
2. In another browser/profile, sign in at `/employee/sign-in` using your existing owner account and choose **Preparation queue** (`/employee/preparation`).
3. Choose **Claim order**, prepare the test drinks, then **Mark ready**. The customer page updates within the next successful poll. No real payment is recorded.
4. Optionally test **Pause new orders** or **Flag for review**, entering a reason. Review resolution and delivery/payment steps are next milestones; held orders do not auto-cancel.

See [V2-2 verification](VERIFICATION-V2-2.md). Use the same `127.0.0.1` origin for login and testing. Production use remains blocked.

cd "/Users/nicholaschan/Desktop/2026 Project/lisi-bnb-ERP"
docker compose --env-file .local/docker.env up -d --wait
npm run dev

Employee account:
email: nicholastc14@gmail.com
password: Nico@1234567890

Owner account:
owner.test@example.invalid
LisiTest-ApGyqCPIIIpPsnvz!

Delivery Employee:
Email: delivery@test.com
Password: Changed@1234567890