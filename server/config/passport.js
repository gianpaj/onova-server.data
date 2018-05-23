// @flow

import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import LocalStrategy from 'passport-local';
import passport from 'passport';

import User, { UserDoc } from '../models/user.model';
import config from './config';

// Configure Passport authenticated session persistence.
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id, (err, user) => {
    done(err, user);
  });
});

// Setting up local login strategy
passport.use(
  new LocalStrategy(
    { usernameField: 'emailAddress' },
    (email, password, done) => {
      // mongoose changes the email to lowercase
      User.findOne({ emailAddress: email.toLowerCase() })
        .then((user: UserDoc) => {
          if (!user) {
            return done(new Error('invalid email'));
          }

          user.comparePassword(password, (err, isMatch) => {
            if (err) return done(err);

            if (isMatch) return done(null, user);

            return done(new Error('invalid password'));
          });
        })
        .catch(err => done(err, false));
    }
  )
);

// Setting JWT strategy options
const jwtOptions = {
  // Telling Passport to check authorization headers for JWT
  jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme('JWT'),
  // Telling Passport where to find the secret
  secretOrKey: config.jwtSecret,
};

// Setting up JWT login strategy
passport.use(
  new JwtStrategy(jwtOptions, (jwt_payload, done) => {
    User.findById(jwt_payload._id)
      .then((user: UserDoc) => {
        if (user) {
          done(null, user);
        } else {
          done(null, false);
        }
        return null;
      })
      .catch(err => done(err, false));
  })
);
