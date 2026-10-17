# Milestone 3 — Short manual test

Use the local development app at http://127.0.0.1:3000 and your existing owner account. Use test customer contact details. No money moves and no food preparation/delivery is performed. Add at least one visible, available item with a positive price before testing; configure courts/tables for those service modes.

1. **Guest checkout:** Add an item, open the cart, change quantity and enter a test name. Choose pickup and place the demo order. Expect a saved order, exact item total, pickup code and private recovery link. Refresh/reopen the saved link: the same order remains. Switch ID/EN and narrow the browser window to inspect usability.
2. **Court/dine-in:** Start a separate order. Court delivery must require an active court, phone and explicit confirmation; dine-in must require an active numbered table. Expect the selected destination on the saved order.
3. **Simulated payment:** In another tab, sign in as owner and open `/employee/demo-payments`. Refresh/select the order and choose **Simulate successful payment**. Customer status should show simulated payment accepted. Replaying the same event must not add another payment. This records eligibility only; there is no preparation queue yet.
4. **Pending change / late payment:** Create another order. Mark its item unavailable before simulating payment, or cancel it from its private status page first. Expect staff review and no automatic preparation eligibility. **Store success without delivery**, then **Reconcile undelivered events**, exercises delayed confirmation.
5. **Refund uncertainty:** Enter a reason on the demo-controls page, request a full simulated refund and choose **Keep outcome unknown**. Another refund request for that payment must remain blocked. **Simulate refund success** confirms it once. For an extra distinct payment, refunding only that extra payment must leave the original accepted order intact.

Optional counter check: `/employee/counter` works for an owner or a separately provisioned counter account. Counter-only staff can create their own orders but cannot operate owner/supervisor payment controls. Sign out on shared devices.

If a response is uncertain, use **Retry the same checkout/command** or review the current recorded status. Do not start a replacement action to guess whether the first succeeded. Guest access links expire after 24 hours; unpaid demo orders close after 15 minutes. Keep test credentials/recovery links out of project files.
