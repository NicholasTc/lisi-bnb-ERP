# V2-1 — Short human review

Local ordering tests only. Do not make a real payment. Preparation/delivery task screens, manual payment verification/collection and reports are later milestones.

1. Open `http://127.0.0.1:3000/employee/sign-in`, sign in as the existing owner, and open **Manage menu & locations**. Add the actual building/court you want to test if the directory is empty. Existing menu/accounts/orders were preserved; no demonstration location was inserted into development.
2. Open the court destination link from location management. Try ID/EN, search/categories and adding a drink. Open the cart; check the court, name, phone, quantity and total. Confirm the court and place the order. Expect **Order received**, an `LB-` reference and **Pay at delivery**, with no payment timer or payment button.
3. Reload the status page, expand **Keep access to your order**, and copy the private link into another browser. It should reopen for 24 hours; a wrong private key should show an invalid-link message. The display reference alone is not a lookup credential. Keep this link private.
4. Cancel before preparation is claimed and confirm. Expect **Order closed**, no cancellation button, and the original order retained. Employee claims are V2-2, so this stage cannot test the actual claim/cancel race or progress the order into preparation.
5. On a phone or narrow browser, review menu, cart and confirmation. Check that the primary action and language/court choices are understandable. Report confusing wording, unnecessary steps or difficult controls before V2-2.

The current development directory contains no buildings/courts; step 1 is needed before a valid court submission. Full Phase 1 payment/handover acceptance remains blocked until the actual official merchant procedure is confirmed. See [verification](VERIFICATION-V2-1.md) and [milestones](implementation-plan.md).
