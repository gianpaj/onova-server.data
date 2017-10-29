import mailjet from 'node-mailjet';
import crypto from 'crypto';

import Verification from '../models/verification.model';
import config from '../../config/config';

// mailjet.connect(MJ_APIKEY_PUBLIC, MJ_APIKEY_PRIVATE);

/**
 * Send email via Mailjet to verify the account
 *
 * @param {string} emailTo
 */
function sendVerificationEmail(emailTo, user) {
  const subject = 'Welcome to Onova - Verify your email address';

  // generate link
  Verification.create({
    user: user._id,
    resetToken: crypto.randomBytes(8).toString('hex')
  })
  .then(verification => {
    console.log(`verification token generated for ${user.emailAddress}`);

    // var request = mailjet
    //   .post("send")
    //   .request({
    //     "FromEmail": "noreply@onova.co",
    //     "FromName": "Onova",
    //     "Subject": subject,
    //     "Recipients":[ { "Email": emailTo } ],
    //     "Text-part": `Hi ${vars.user}\n`+
    //         `Thanks for registering on Onova.\n`+
    //         `Click this link to verify your email address: ${vars.link}.\n`+
    //         `The link will expire in 24h.\n`
    //   });

    // request
    //   .then(res => {
    //     console.log(res.body);
    //     resolve(res.body);
    //   })
    //   .catch(err => {
    //     console.log(err.statusCode);
    //     reject(err);
    //   });
  })
  .catch(e => console.error(e));
}

/**
 * Generate password token t
 *
 * @returns {string}
 */
function generatePassToken() {

}

export default { sendVerificationEmail };
