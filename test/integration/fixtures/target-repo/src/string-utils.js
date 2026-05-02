function capitalize(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function reverse(s) {
  return s.split("").reverse().join("");
}

function truncate(s, maxLen) {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen) + "...";
}

module.exports = { capitalize, reverse, truncate };
