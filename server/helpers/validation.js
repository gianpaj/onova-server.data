/**
 * Regexes used to validate inputs and DB schema
 */
export default {
  username: /^[a-zA-Z\u0400-\u04FF0-9\_\.]+$/,
  mobileNumber: /^[1-9][0-9]{9}$/,
};
