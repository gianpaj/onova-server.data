// @flow

// import _ from 'lodash';
import instagramScraping from '../helpers/instagram-scraping';
import { Drop, Product, InstagramScrapped, User } from '../models';
import config from '../config/config';

import { agenda } from '../config/express';
import { uploadURLToGCS } from '../controllers/photos.controller';
// const debug = require('debug')('server-data:instagram');
const debug = console.log;

const { JOBNAMES } = config;

export default class InstagramRunner {
  constructor() {
    // TODO: only start it if we're testing this runner
    // if (config.env == 'test') {
    //     this.initJob();
    // } else {
    this.initJob();
    // }
  }

  initJob() {
    this.defineScrapingJob();

    agenda.on('ready', () => {
      agenda.cancel({ name: JOBNAMES.IG_SCRAPPING }, (err, numRemoved) => {
        if (err) return console.error(err);
        debug(`${JOBNAMES.IG_SCRAPPING} job cleaned up:`, numRemoved);
        agenda.start();
        this.createScrapingJob();
      });
    });
  }

  createScrapingJob() {
    const job = agenda.create(JOBNAMES.IG_SCRAPPING);
    job.unique({ jobName: JOBNAMES.IG_SCRAPPING });
    job.repeatEvery(config.env === 'test' ? '3 seconds' : '30 seconds');
    job.save();
  }

  defineScrapingJob() {
    agenda.define(JOBNAMES.IG_SCRAPPING, async (job, done) => {
      debug(`${JOBNAMES.IG_SCRAPPING} job running at`, new Date());

      try {
        const users = await User.find({ 'scraping.instagram': { $exists: true } });
        debug('users found:', users.length);
        if (!users.length) return done();

        const IG_usernames = users.map(u => u.scraping.instagram);
        const user_pages = await Promise.all(IG_usernames.map(instagramScraping.scrapeUserPageDeep));

        // console.log(user_pages[0]);

        let IG_docs_to_scrape = [];

        for (let i = 0; i < user_pages.length; i++) {
          const user_page = user_pages[i];
          debug('user scrapped:', user_page.username);
          // console.log(user_page.medias[0]);
          const IG_doc = await InstagramScrapped.find({ instagramOwnerId: user_page.instagramOwnerId })
            .sort({ timestamp: -1 })
            .limit(1); // last post by timestamp
          const last_IGPost_timestamp_scrapped = Math.max(...user_page.medias.map(media => media.timestamp));
          console.log('last_IGPost_timestamp_scrapped', last_IGPost_timestamp_scrapped);
          // if we found a newer IG post (with a greater timestamp)

          // if we previously scrapped this user
          if (IG_doc.length > 0) {
            // only new posts
            IG_docs_to_scrape = [
              ...IG_docs_to_scrape,
              ...user_page.medias.filter(doc => doc.timestamp > user_page.medias[0].timestamp),
            ];
            debug('no new IG_docs_to_scrape for', user_page.username);
          } else {
            // scrape all
            IG_docs_to_scrape = [...IG_docs_to_scrape, ...user_page.medias];
          }
        }

        // TODO: filter docs without the #onova hashtag in the description
        IG_docs_to_scrape = IG_docs_to_scrape.filter(doc => doc.description);

        debug('IG_docs_to_scrape', IG_docs_to_scrape.length);
        if (!IG_docs_to_scrape.length) {
          return done();
        }

        await InstagramScrapped.insertMany(IG_docs_to_scrape);

        console.log(IG_docs_to_scrape[0]);

        // for (let j = 0; j < IG_docs_to_scrape.length; j++) {
        //   const doc = IG_docs_to_scrape[j];
        //   const uploadedImages = await uploadURLToGCS(doc.images);

        // }

        // const arrayOfArrayOfMedias = user_pages.map(u => u.medias);
        // const arrayOfMedias = [].concat.apply([], arrayOfArrayOfMedias);

        // console.log(IG_docs[0].images);
        // const arrayOfURLs = [].concat.apply([], IG_docs.map(doc => doc.images));

        // console.log(uploadedImages);

        // for each IG doc, create a Product + Drop
        // Upload the images

        done();
      } catch (error) {
        console.error(JOBNAMES.IG_SCRAPPING);
        console.error(error);
        done(error);
      }
    });
  }
}
