/**
 * Regexes used to validate inputs and DB schema
 */
export default {
  username: /^[a-zA-Zа-яА-Я0-9\_\.]*$/,
  usernameGlobal: /@[a-zA-Zа-яА-Я0-9\_\.]*/g,
  mobileNumber: /^[1-9][0-9]{9}$/,
};
