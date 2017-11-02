import mailjet from 'node-mailjet';
import crypto from 'crypto';

import Verification from '../models/verification.model';
import config from '../config/config';

const mailjetClient = mailjet.connect(config.mailjet.apikeyPublic, config.mailjet.apikeyPrivate);

/**
 * Send email via Mailjet to verify the account
 *
 * @param {string} emailTo
 */
function sendVerificationEmail(emailTo, user) {
  const subject = 'Welcome to Onova - Verify your email address';

  const token = crypto.randomBytes(8).toString('hex');

  // generate link
  Verification.create({
    user: user._id,
    resetToken: token
  })
  .then(verification => {
    const vars = {
      confirmation_link: `https://onova.co/api/auth/activate/${token}`,
      displayName: user.displayName
    }

    var request = mailjetClient
      .post("send", {'version': 'v3.1'})
      .request({
        "Messages":[
          {
            "From": {
              "Email": "noreply@onova.co",
              "Name": "Onova"
            },
            "To": [
              { "Email": emailTo, "Name": vars.displayName }
            ],
            "Variables": vars,
            "TemplateID": 241369,
            "TemplateLanguage": true,
            "Subject": subject
          }
        ]
      });

    request
      .then(res => {
        // console.log(res.body);
      })
      .catch(err => {
        console.error(err.statusCode);
      });
  })
  .catch(e => console.error(e));
}

export default { sendVerificationEmail };
