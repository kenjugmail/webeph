(() => {
  const form = document.querySelector('#waitlist-form');
  const status = document.querySelector('#waitlist-status');
  const button = form.querySelector('button[type=submit]');
  let busy = false;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy || !form.reportValidity()) return;
    const data = new FormData(form);
    if (data.get('contact_url')) return;
    if (!data.getAll('interests').length) {
      status.textContent = 'Please select at least one area of interest.';
      form.querySelector('[name=interests]').focus();
      return;
    }
    const payload = Object.fromEntries(data);
    payload.interests = data.getAll('interests');
    payload.consent = data.get('consent') === 'on';
    delete payload.contact_url;
    busy = true;
    button.disabled = true;
    status.textContent = 'Submitting…';
    try {
      const config = window.ORRERY_CONFIG;
      const response = await fetch(`${config.CLOUD_AUTH_URL}/functions/v1/company-waitlist`, {
        method: 'POST',
        headers: { apikey: config.CLOUD_AUTH_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission: payload }),
        signal: AbortSignal.timeout(20000)
      });
      if (response.status === 429) throw new Error('rate-limit');
      if (!response.ok) throw new Error('Submission failed');
      form.reset();
      status.textContent = 'Thank you for joining the Ephemerent Intelligence waitlist. We’ll contact selected organizations as early-access and pilot opportunities become available.';
      button.textContent = 'Joined the waitlist';
      status.focus();
    } catch (error) {
      status.textContent = error.message === 'rate-limit' ? 'Too many attempts. Please try again later or email kt@ephemerent.com. Your answers are still here.' : 'We couldn’t confirm your submission. Please try again or email kt@ephemerent.com. Your answers are still here.';
      button.disabled = false;
      busy = false;
    }
  });
})();
