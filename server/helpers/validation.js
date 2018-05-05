/**
 * Regexes used to validate inputs and DB schema
 */
export default {
  username: /^[a-zA-Z0-9\_\.]+$/,
  hashtag: /^[a-zA-Z\u0400-\u04FF0-9]+$/,
  mobileNumber: /^[1-9][0-9]{9}$/,
};
