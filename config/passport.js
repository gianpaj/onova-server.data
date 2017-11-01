import { Strategy, ExtractJwt } from 'passport-jwt';
import LocalStrategy from 'passport-local';
import passport from 'passport';

import User from '../server/models/user.model';
import config from './config';

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id, (err, user) => {
    done(err, user);
  });
});

// Setting up local login strategy
passport.use(new LocalStrategy({ usernameField: 'emailAddress'}, (email, password, done) => {
  User.findOne({ emailAddress: email.toLowerCase() }, (err, user) => {
    if(err) { return done(err); }
    if(!user) {
      return done(null, false, { error: 'Invalid email or password.' });
    }

    user.comparePassword(password, (err, isMatch) => {
      if (err) { return done(err); }

      if (isMatch) {
        return done(null, user);
      }

      return done(null, false, { error: 'Invalid email or password.' });
    });
  });
}));


// Setting JWT strategy options
const jwtOptions = {
  // Telling Passport to check authorization headers for JWT
  jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme('JWT'),
  // Telling Passport where to find the secret
  secretOrKey: config.jwtSecret
};


// Setting up JWT login strategy
passport.use(new Strategy(jwtOptions, function (jwt_payload, done) {
  User.findById(jwt_payload._id, function (err, user) {
    if (err) { return done(err, false) }

    if (user) {
      done(null, user);
    } else {
      done(null, false);
    }
  });
}));
