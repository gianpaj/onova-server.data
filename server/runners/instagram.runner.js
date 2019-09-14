// @flow
import throat from 'throat';
import pick from 'lodash/pick';

import instagramScraping, { getRandomArbitrary } from '../helpers/instagram-scraping';
import { InstagramScrapped, User, Product } from '../models';
import config from '../config/config';

import { agenda } from '../config/express';
import { sleep } from '../__tests__/utils';
import { uploadURLToGCS } from '../controllers/photos.controller';
import dropController from '../controllers/drop.controller';

const debug = console.log;
// const debug = require('debug')('server-data:instagram');

const { JOBNAMES } = config;

let created = false;

export default class InstagramRunner {
  constructor() {
    if (config.env !== 'test') this.initJob();
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
    if (config.env !== 'test') job.repeatEvery('10 minutes');
    job.save();
  }

  defineScrapingJob() {
    agenda.define(JOBNAMES.IG_SCRAPPING, { concurrency: 1, lockLimit: 1 }, (job, done) => {
      // expire after 20 mins
      const timer = setTimeout(() => {
        console.error(JOBNAMES.IG_SCRAPPING, 'expired');
        done();
      }, 20 * 60 * 1000);
      this.scrape(job)
        .then(() => done())
        .catch(e => done(e))
        .then(() => clearTimeout(timer));
    });
  }

  async scrape(job) {
    try {
      debug(`${JOBNAMES.IG_SCRAPPING} job running at`, new Date());

      const users = await User.find({
        // 'scraping.instagram': { $in: ['warmink_design', 'zelenew_shop'] },
        'scraping.instagram': { $exists: true },
        $or: [
          { 'paymentInfo.short.card_token': { $exists: true } },
          { 'paymentInfo.full.card_token': { $exists: true } },
        ],
        'shippingAddress.departmentNovaposhta': { $exists: true },
        'shippingAddress.city': { $exists: true },
        'shippingAddress.firstName': { $exists: true },
        'shippingAddress.lastName': { $exists: true },
      });
      debug('users found:', users.length);
      if (!users.length) return;
      console.log(users.map(u => pick(u, 'scraping.instagram', 'username', '_id')));

      const IG_usernames = users.map(u => u.scraping.instagram);
      // Chunk up the scraping of instagram users to 4 at the same time
      let user_pages = [];
      // for (let i = 0; i < 2; i++) {
      for (let i = 0; i < IG_usernames.length; i++) {
        debug("scrapping user's posts: %j", IG_usernames[i]);
        let IG_ids_to_filter = await InstagramScrapped.find({ username: new RegExp(IG_usernames[i], 'i') });
        if (IG_ids_to_filter.length) IG_ids_to_filter = IG_ids_to_filter.map(d => d.instagramId);
        const user_page = await instagramScraping.scrapeUserPageDeep(IG_usernames[i], IG_ids_to_filter).catch(e => {
          console.error(e);
          return e;
        });
        await sleep(getRandomArbitrary(1000, 1500));
        debug("scrapping user's posts: %j ✅", user_page.username);
        user_pages.push(user_page);
      }

      user_pages = user_pages.filter(user_page => !(user_page instanceof Error));

      debug('user pages scrapped successfully:', user_pages.length);

      let IG_medias_to_scrape = [];

      for (let i = 0; i < user_pages.length; i++) {
        const user_page = user_pages[i];
        debug('user scrapped:', user_page.username);
        // debug(user_page.medias[0]);
        let IG_ids = await InstagramScrapped.find({ instagramOwnerId: user_page.instagramOwnerId });
        if (IG_ids.length) IG_ids = IG_ids.map(d => d.instagramId);

        // Find the category of the last item for each User-Product
        const productCategory = await Product.findOne({ seller: users[i]._id }).sort({ _id: -1 });

        // if we previously scrapped this user
        if (IG_ids.length) {
          // filter already scrapped IG medias
          const newMedias = user_page.medias.filter(m => IG_ids.indexOf(m.instagramId) < 0);
          // only new posts
          IG_medias_to_scrape = [
            ...IG_medias_to_scrape,
            // when testing scrape 3 posts per user
            // ...newMedias.filter((_, i) => i < 3),
            ...newMedias,
          ];
          // debug('%d new IG_medias_to_scrape for %j', newMedias.filter((_, i) => i < 3).length, user_page.username);
          debug('%d new IG_medias_to_scrape for %j', newMedias.length, user_page.username);
        } else {
          // scrape all
          IG_medias_to_scrape = [
            ...IG_medias_to_scrape,
            // when testing scrape 3 posts per user
            // ...user_page.medias.filter((_, i) => i < 3),
            ...user_page.medias,
          ];
          debug('%d IG_medias_to_scrape for %j (first time)', user_page.medias.length, user_page.username);
        }
        IG_medias_to_scrape = IG_medias_to_scrape.map(doc => ({
          ...doc,
          onovaUser: doc.onovaUser ? doc.onovaUser : users[i],
          // Men Clothes by default
          lastProductCategoryIds: doc.lastProductCategoryIds
            ? doc.lastProductCategoryIds
            : productCategory
              ? productCategory.categoryIds
              : [0],
        }));
        IG_medias_to_scrape = IG_medias_to_scrape.filter(doc => doc.description);
      }

      debug('total IG_docs_to_scrape:', IG_medias_to_scrape.length);
      if (!IG_medias_to_scrape.length) {
        return;
      }

      const IG_docs_to_scraped = await Promise.all(
        // Chunk up the image upload to 4 images at the same time
        IG_medias_to_scrape.reverse().map(
          throat(4, async doc => {
            const uploadedImages = await uploadURLToGCS(doc.images);
            // const uploadedImages = [
            //   'https://storage.googleapis.com/temp-uploads.onova.co/dGbEB7IHm-1-1568133652508.jpg',
            // ];
            if (job) await job.touch();
            return { ...doc, uploadedImages };
          })
        )
      );

      const drops = await Promise.all(
        // nice to do - group by user (doc.onovaUser._id) to create a single drop with all the products
        IG_docs_to_scraped.map(doc =>
          new Promise((resolve, reject) => {
            const priceString = this.extractPrice(doc.description);
            if (parseInt(priceString) < 150) return reject('min price is 150', JSON.stringify(doc));

            const product = {
              categoryIds: doc.lastProductCategoryIds,
              description: this.removeHashtags(doc.description),
              photos: doc.uploadedImages,
              price: priceString,
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

      await InstagramScrapped.insertMany(IG_medias_to_scrape);

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
  extractPrice(text): string {
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
