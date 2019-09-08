// @flow

import instagramScraping from '../helpers/instagram-scraping';
import { InstagramScrapped, User, Product } from '../models';
import config from '../config/config';

import { agenda } from '../config/express';
import { uploadURLToGCS } from '../controllers/photos.controller';
import dropController from '../controllers/drop.controller';

// const debug = require('debug')('server-data:instagram');
const debug = console.log;

const { JOBNAMES } = config;

let created = false;

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
        // agenda.start();
        this.createScrapingJob();
      });
    });
  }

  createScrapingJob() {
    if (created) return;
    created = true;
    const job = agenda.create(JOBNAMES.IG_SCRAPPING);
    job.unique({ jobName: JOBNAMES.IG_SCRAPPING });
    if (config.env !== 'test') job.repeatEvery('60 seconds');
    job.save();
  }

  defineScrapingJob() {
    agenda.define(JOBNAMES.IG_SCRAPPING, { concurrency: 1, lockLimit: 1 }, (job, done) => {
      this.scrape(job)
        .then(() => done())
        .catch(e => done(e));
    });
  }

  async scrape(job) {
    // return new Promise((resolve, reject) => {
    // if (config.env === 'test') await sleep(1000);
    try {
      debug(`${JOBNAMES.IG_SCRAPPING} job running at`, new Date());

      // TODO: (and test) do not scrape users without payment info
      const users = await User.find(
        {
          'scraping.instagram': { $exists: true },
          // 'seller.paymentInfo': { $exists: true }
        },
        { scraping: 1 }
      );
      debug('users found:', users.length);
      if (!users.length) return done();

      const IG_usernames = users.map(u => u.scraping.instagram);
      const user_pages = await Promise.all(IG_usernames.map(instagramScraping.scrapeUserPageDeep));

      // console.log(user_pages[0]);

      let IG_docs_to_scrape = [];

      for (let i = 0; i < user_pages.length; i++) {
        const user_page = user_pages[i];
        debug('user scrapped:', user_page.username);
        debug(user_page.medias[0]);
        const IG_doc = await InstagramScrapped.find({ instagramOwnerId: user_page.instagramOwnerId })
          .sort({ timestamp: -1 })
          .limit(1); // last post by timestamp
        const last_IGPost_timestamp_scrapped = Math.max(...user_page.medias.map(media => media.timestamp));
        debug('last_IGPost_timestamp_scrapped', last_IGPost_timestamp_scrapped);
        // if we found a newer IG post (with a greater timestamp)

        // Find the category of the last item for each User-Product
        const productCategory = await Product.findOne({ seller: users[i]._id }).sort({ _id: -1 });

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
          IG_docs_to_scrape = [
            ...IG_docs_to_scrape.map(doc => ({
              ...doc,
              onovaUser: users[i],
              lastProductCategoryIds: productCategory.categoryIds,
            })),
            ...user_page.medias,
          ];
        }
        IG_docs_to_scrape = IG_docs_to_scrape.map(doc => ({
          ...doc,
          onovaUser: users[i],
          // Men Clothes by default
          lastProductCategoryIds: productCategory ? productCategory.categoryIds : [0],
        }));
      }

      IG_docs_to_scrape = IG_docs_to_scrape.filter(doc => doc.description);

      debug('IG_docs_to_scrape', IG_docs_to_scrape.length);
      if (!IG_docs_to_scrape.length) {
        return resolve();
      }

      await InstagramScrapped.insertMany(IG_docs_to_scrape);

      for (let j = 0; j < IG_docs_to_scrape.length; j++) {
        const doc = IG_docs_to_scrape[j];
        // TODO: improve speed by parallelising & returning index of array
        const uploadedImages = await uploadURLToGCS(doc.images);
        // const uploadedImages = ['https://storage.googleapis.com/temp-uploads.onova.co/1567677448651.jpg'];
        // console.log(uploadedImages);
        IG_docs_to_scrape[j].uploadedImages = uploadedImages;

        // tell Agenda the job is still running, which resets the lock timeout
        if (job) await job.touch();

        // when testing stop after scraping 3 images
        if (config.env === 'test' && j > 0) break;
        // if (config.env === 'test' && j > 2) break;
      }

      // console.log(IG_docs_to_scrape[0]);

      const drops = await Promise.all(
        IG_docs_to_scrape.map(doc =>
          new Promise((resolve, reject) => {
            const product = {
              categoryIds: doc.lastProductCategoryIds,
              description: this.removeHashtags(doc.description),
              photos: doc.uploadedImages,
              price: this.extractPrice(doc.description),
              quantity: 1,
              tags: doc.description ? this.extractHashtags(doc.description) : [],
            };
            dropController.create(
              {
                user: { _id: doc.onovaUser._id },
                body: {
                  date: new Date(), // post now
                  products: [product],
                  instagram: doc.instagramId,
                  ...this.getPostLocation(doc),
                  // longitude: 23.9573617,
                  // latitude: 49.8134431,
                },
              },
              drop => resolve(drop),
              err => reject(err),
              true
            );
          }).catch(e => {
            console.error(e);
            return e;
          })
        )
      );

      const validDrops = drops.filter(drop => !(drop instanceof Error));

      // console.log('drops attempted to create', drops.length);
      debug('validDrops created', validDrops.length);

      return;
    } catch (error) {
      console.error(JOBNAMES.IG_SCRAPPING);
      console.error(error);
      // reject(error)
      throw error;
    }
    // })
  }

  /**
   * Extract hashtags from Instagram post description, excluding #onova
   *
   * https://stackoverflow.com/a/56954025/728287
   *
   * @param {String} text
   * @returns {Array<String>}
   */
  extractHashtags(text) {
    return (text.match(/#[^\s#\.\;]*/g) || []).map(v => v.replace('#', '')).filter(v => !new RegExp(/onova/i).test(v));
  }

  /**
   * Remove hashtags from the end of the string (for Instagram post description) and leave the other hashtags but without the # char
   *
   * Inspired from https://stackoverflow.com/a/29822636/728287
   *
   * @param {String} text
   * @returns {String}
   */
  removeHashtags(text = '') {
    return text
      .replace(/(\s#[^\s#\.\;]+)*$/g, '')
      .replace('#', '')
      .trim();
  }

  getLvivCoordinates() {
    return {
      longitude: 23.9573617,
      latitude: 49.8134431,
    };
  }

  /**
   * Parse price or set to 99999.00 as default
   */
  extractPrice(text) {
    const regex1 = new RegExp(/(\b\d{0,6}\.?\d{1,2})\s+(UAH)/);
    // e.g. #здійснюємо 100 UAH Україні => 100
    if (regex1.test(text)) {
      return text.match(regex1)[1];
    }
    const regex2 = new RegExp(/(\b\d{0,6}\.?\d{1,2})\s+(грн)/);
    // e.g. #здійснюємо 100 грн Україні => 100
    if (regex2.test(text)) {
      return text.match(regex2)[1];
    }
    const regex3 = new RegExp(/₴\s?(\b\d{0,6}(?:\.?\d{1,2}))/);
    // e.g. #здійснюємо ₴100 Україні => 100
    if (regex3.test(text)) {
      return text.match(regex3)[1];
    }

    return '99999.00';
  }

  /**
   * If the IG post has a location name use that as city name
   * or use by default the coordinates of Lviv (not used at the moment - only stored)
   *
   * @param {*} doc
   */
  getPostLocation(doc) {
    return doc.location ? doc.location : this.getLvivCoordinates();
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
