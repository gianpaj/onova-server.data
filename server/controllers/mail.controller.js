// @flow

import mailjet from 'node-mailjet';
import crypto from 'crypto';

import Verification from '../models/verification.model';
import UserDoc from '../models/user.model';
import config from '../config/config';

const mailjetClient = mailjet.connect(
  config.mailjet.apikeyPublic,
  config.mailjet.apikeyPrivate
);

/**
 * Send email via Mailjet to verify the account
 *
 * @param {string} emailTo
 * @param {User} user
 */
function sendVerificationEmail(emailTo: string, user: UserDoc): Promise<any> {
  const subject = 'Welcome to Onova - Verify your email address';

  const token = crypto.randomBytes(8).toString('hex');

  // generate link
  return Verification.create({
    user: user._id,
    resetToken: token,
  })
    .then(() => {
      const vars = {
        confirmation_link: `https://onova.co/api/auth/activate/${token}`,
        displayName: user.displayName,
      };

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
      // .then(res => {
        // console.log(res.body);
      // })
      .catch(err => {
        console.error(err.ErrorMessage);
      });
  })
  .catch(e => console.error(e));
}

/**
 * Send email via Mailjet to re-verify the account
 */
function resendVerificationEmail(emailTo: string, user: Object): void {
  const subject = 'Verify your new email address';

  const token = crypto.randomBytes(8).toString('hex');

  // generate link
  Verification.create({
    user: user._id,
    resetToken: token,
  })
    .then(() => {
    const vars = {
      confirmation_link: `https://onova.co/api/auth/activate/${token}`,
        displayName: user.displayName,
      };

      // var request = mailjetClient
      //   .post("send", {'version': 'v3.1'})
      //   .request({
      //     "Messages":[
      //       {
      //         "From": {
      //           "Email": "noreply@onova.co",
      //           "Name": "Onova"
      //         },
      //         "To": [
      //           { "Email": emailTo, "Name": vars.displayName }
      //         ],
      //         "Variables": vars,
      //         "Subject": subject,
      //         "TemplateLanguage": true,
      //         "TextPart": "Hi {{var:displayName}},\n\nPlease verify your new email address.\n\nClick here to confirm it: {{var:confirmation_link}}.\n\nCheers, The Onova Team.",
      //         "HTMLPart": "Hi {{var:displayName}},<p>Please verify your new email address.</p><p>Click here to confirm it: {{var:confirmation_link}}</p><p>Cheers, The Onova Team.</p>",
      //       }
      //     ],
      //     "SandboxMode": true
      //   });

      // request
      //   .then(res => {
      //     // console.log(res.body);
      //   })
      //   .catch(err => {
      //     console.error(err.ErrorMessage);
      //   });
  })
  .catch(e => console.error(e));
}

/**
 * Send email via Mailjet to reset the account's password
 */
function sendResetEmail(emailTo: string, user: Object): void {
  const subject = 'Password reset';

  const token = crypto.randomBytes(8).toString('hex');

  // generate link
  Verification.create({
    user: user._id,
    resetToken: token,
  })
    .then(() => {
    const vars = {
      reset_link: `https://onova.co/api/auth/reset/${token}`,
        displayName: user.displayName,
      };

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
            "Subject": subject,
            "TemplateLanguage": true,
            "TextPart": "Hi {{var:displayName}},\n\nYou have requested to reset your password. If you haven't simply ignore this email.\n\nClick here to reset your password: {{var:reset_link}}.\n\nCheers, The Onova Team.",
            "HTMLPart": "Hi {{var:displayName}},<p>You have requested to reset your password. If you haven't simply ignore this email.</p><p>Click here to reset your password: {{var:reset_link}}</p><p>Cheers, The Onova Team.</p>",
          }
        ],
        SandboxMode: true
      });

    request
      // .then(res => {
        // console.log(res.body);
      // })
      .catch(err => {
        console.error(err.ErrorMessage);
      });
  })
  .catch(e => console.error(e));
}

export default {
  sendVerificationEmail,
  resendVerificationEmail,
  sendResetEmail,
};
