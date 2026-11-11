/**
 * Hosted Razorpay Standard Checkout page for native apps (Expo Go and dev
 * builds cannot load Razorpay's JS SDK). It is opened in the system browser
 * with a short-lived, single-order signed token; payment confirmation still
 * happens server-side (signature + Razorpay API), never from this page's claim.
 */
const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string
  ));

export function renderCheckoutPage(input: {
  keyId: string;
  razorpayOrderId: string;
  amount: number;
  currency: 'INR';
  description: string;
  callbackUrl: string;
  returnUrl: string;
}): string {
  const config = JSON.stringify({
    key: input.keyId,
    order_id: input.razorpayOrderId,
    amount: input.amount,
    currency: input.currency,
    description: input.description,
    callbackUrl: input.callbackUrl,
    returnUrl: input.returnUrl,
  }).replace(/</g, '\\u003c');
  const rupees = (input.amount / 100).toLocaleString('en-IN');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>BranchSuite payment</title>
<style>
body{font-family:system-ui,sans-serif;background:#edf2fa;color:#1b2d4a;margin:0;padding:24px;display:flex;justify-content:center}
main{background:#fff;border:1px solid #d6e0ef;border-radius:16px;padding:24px;max-width:420px;width:100%}
button,a.btn{display:block;width:100%;box-sizing:border-box;text-align:center;padding:14px;border-radius:12px;border:0;background:#3157d5;color:#fff;font-size:16px;font-weight:700;margin-top:16px;text-decoration:none}
p{line-height:1.5;color:#586d8b}.amt{font-size:28px;font-weight:800;color:#1b2d4a}
</style></head><body><main>
<h1>BranchSuite Business</h1>
<p>${escapeHtml(input.description)}</p>
<p class="amt">₹${escapeHtml(rupees)}</p>
<p id="status">Opening secure Razorpay checkout…</p>
<button id="pay" type="button">Pay now</button>
<a id="back" class="btn" style="display:none" href="#">Return to BranchSuite</a>
</main>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
(function(){
  var cfg = ${config};
  var statusEl = document.getElementById('status');
  var payBtn = document.getElementById('pay');
  var backEl = document.getElementById('back');
  backEl.href = cfg.returnUrl;
  function done(text){ statusEl.textContent = text; payBtn.style.display='none'; backEl.style.display='block'; }
  function open(){
    if (!window.Razorpay) { statusEl.textContent = 'Could not load Razorpay. Check your connection and try again.'; return; }
    var rzp = new window.Razorpay({
      key: cfg.key, order_id: cfg.order_id, amount: cfg.amount, currency: cfg.currency,
      name: 'BranchSuite Business', description: cfg.description, theme: { color: '#3157d5' },
      handler: function(response){
        statusEl.textContent = 'Confirming your payment…'; payBtn.style.display='none';
        fetch(cfg.callbackUrl, { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ razorpayPaymentId: response.razorpay_payment_id, razorpaySignature: response.razorpay_signature }) })
          .then(function(r){ return r.json().catch(function(){return {};}).then(function(b){ return {ok:r.ok,b:b}; }); })
          .then(function(res){
            if (res.ok && (res.b.state==='APPLIED' || res.b.state==='ALREADY_APPLIED')) done('Payment confirmed. Return to the app to continue.');
            else if (res.ok) done('Payment received. Return to the app; it will confirm automatically.');
            else done('We could not confirm the payment yet. Return to the app and tap Refresh status.');
          }).catch(function(){ done('Payment submitted. Return to the app and tap Refresh status.'); });
      },
      modal: { ondismiss: function(){ statusEl.textContent = 'Checkout closed. You can try again.'; payBtn.style.display='block'; } }
    });
    rzp.on('payment.failed', function(r){ statusEl.textContent = 'Payment failed: ' + ((r.error && r.error.description) || 'please try again') ; payBtn.style.display='block'; });
    rzp.open();
  }
  payBtn.addEventListener('click', open);
  window.addEventListener('load', function(){ setTimeout(open, 300); });
})();
</script></body></html>`;
}
