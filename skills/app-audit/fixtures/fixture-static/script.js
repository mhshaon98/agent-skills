// The only script on the site: mark the current page in the nav, and print the
// year in the footer. No analytics, no cookies, no network requests.
(function () {
  var here = window.location.pathname.split('/').pop() || 'index.html';

  document.querySelectorAll('nav a').forEach(function (link) {
    if (link.getAttribute('href') === here) {
      link.setAttribute('aria-current', 'page');
    }
  });

  var footer = document.querySelector('footer p');
  if (footer) {
    footer.textContent = '© ' + new Date().getFullYear() + ' Harbourline Joinery';
  }
})();
