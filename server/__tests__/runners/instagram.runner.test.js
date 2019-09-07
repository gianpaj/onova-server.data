import request from 'supertest';
import httpStatus from 'http-status';
import nock from 'nock';
import fs from 'fs';

import app from '../../index';
import config from '../../config/config';
import { beforeAllTests, clearJobs, closeDBConnection, createUserAndLogin, findJobs } from '../utils';
import { InstagramRunner } from '../../runners';
import { Product } from '../../models';

jest.setTimeout(10000);

describe('## Instagram Runner', () => {
  beforeAll(beforeAllTests);

  let user1 = {
    username: 'userone',
    emailAddress: 'userone@gmail.com',
    password: 'expressos',
  };

  let user1JwtToken;

  // afterAll(() => {
  //   superagentMock.unset();
  // });

  describe('Scrape Instagram and create Product', () => {
  describe('Unit tests', () => {
    const IG_Class = new InstagramRunner();

    it('should extract the hashtags from post description (all at the end)', () => {
      const description =
        '📬 Відправку здійснюємо по Україні 🇺🇦 та закордон 🛸\n⠀\nВартість доставки не включена в ціну товару.\n⠀\nВідправлення відбувається в тот самий день коли відбулась передоплата.\n⠀\nПісля відправки, надсилаємо фото декларації у Facebook/Instagram, по якому Ви зможете відслідковувати замовлення 🌏\n⠀\nДОСТАВКА МОЖЛИВА:\n🍓 на відділення Нової пошти;\n🍓 на відділення Укрпошти;\n🍓 самовивіз з майстерні м. Львів, вул. Угорська, 2\n⠀\n📌 ВАЖЛИВО! Перевіряйте товар відразу при отриманні у відділенні!\n⠀\nЗалишились питання?\n👉 пишіть нам у Messenger ✉\n👉 або звертайтесь за телефоном: (068) 099 49 06\n⠀\n#horondi #lviv #ukraine #Львів #Горонді #наплічники #рюкзак #бананки #рюкзакльвів #рюкзакукраїна #рюкзакдляподорожей #рюкзакдляміста #рюкзакдлямам #рюкзаки #рюкзаккупити #бананки #бананочки #сумку #бананкальвів #рюкзакльвів #наплічник #сумкачерезплече #гаманець #щастя #любов #друзі #подарунок #деньнародження';
      const hashtags = description
        .slice(description.indexOf('#'))
        .replace(/#/g, '')
        .split(/\s/);
      expect(IG_Class.extractHashtags(description)).toEqual(hashtags);
    });

    it('should extract the hashtags from post description (in the middle as well)', () => {
      const description =
        "Бананка 🍎  вже стала незамінною річчю у побуті 😏\n⠀\nадже це зручно, а з бананками від Horondi це щей красиво, стильно і завжди яскраво 🖤❤\n⠀\n📏 Розмір: 17х35 см\n⠀\nНаші #бананки із якісного, міцного матеріалу. ⠀\n✅ Вмістка;\n✅ Ззовні є кишеня для дрібничок;\n✅ Всередині кишеня на липучці;\n⠀\nДодайте трішки Horondi в своє життя і воно обов'язково стане яскравішим🖤💜🧡💛💚💙❤\n⠀\n🍎 Також Ви можете обрати колір тканини та різновид габалену для Вашої майбутньої бананки;\n⠀\n🍎 Ціна 400 грн.*\n⠀\n* При змінні тканини/габалену, просимо ціну уточнювати у менеджерів 💚\n⠀\nЗалишились питання?\n👉 пишіть нам у Messenger ✉\n👉 або звертайтесь за телефоном: (068) 099 49 06\n⠀\n#horondi #lviv #ukraine #Львів #Горонді #наплічники #рюкзак #бананки #рюкзакльвів #рюкзакукраїна #рюкзакдляподорожей #рюкзакдляміста #рюкзакдлямам #рюкзаки #рюкзаккупити #бананки #бананочки #сумку #бананкальвів #рюкзакльвів #наплічник #сумкачерезплече #гаманець #щастя #любов #друзі #подарунок #деньнародження";
      const hashtags = description
        .slice(description.indexOf('#horondi'))
        .replace(/#/g, '')
        .split(/\s/);
      expect(IG_Class.extractHashtags(description)).toEqual(['бананки', ...hashtags]);
    });

    it('should extract the hashtags from post description (in the middle as well - another)', () => {
      const description =
        '📬 Відправку #здійснюємо по Україні 🇺🇦 та закордон 🛸\n⠀\nВартість доставки не включена в ціну товару.\n⠀\nВідправлення відбувається в тот самий день коли відбулась передоплата.\n⠀\nПісля відправки, надсилаємо фото декларації у Facebook/Instagram, по якому Ви зможете відслідковувати замовлення 🌏\n⠀\nДОСТАВКА МОЖЛИВА:\n🍓 на відділення Нової пошти;\n🍓 на відділення Укрпошти;\n🍓 самовивіз з майстерні м. Львів, вул. Угорська, 2\n⠀\n📌 ВАЖЛИВО! Перевіряйте товар відразу при отриманні у відділенні!\n⠀\nЗалишились питання?\n👉 пишіть нам у Messenger ✉\n👉 або звертайтесь за телефоном: (068) 099 49 06\n⠀\n#horondi #lviv #ukraine #Львів #Горонді #наплічники #рюкзак #бананки #рюкзакльвів #рюкзакукраїна #рюкзакдляподорожей #рюкзакдляміста #рюкзакдлямам #рюкзаки #рюкзаккупити #бананки #бананочки #сумку #бананкальвів #рюкзакльвів #наплічник #сумкачерезплече #гаманець #щастя #любов #друзі #подарунок';
      const hashtags = description
        .slice(description.indexOf('#horondi'))
        .replace(/#/g, '')
        .split(/\s/);
      expect(IG_Class.extractHashtags(description)).toEqual(['здійснюємо', ...hashtags]);
    });

    it('should remove the hashtags from the description', () => {
      const description =
        '📬 Відправку #здійснюємо по Україні 🇺🇦 та закордон 🛸\n⠀\nВартість доставки не включена в ціну товару.\n⠀\nВідправлення відбувається в тот самий день коли відбулась передоплата.\n⠀\nПісля відправки, надсилаємо фото декларації у Facebook/Instagram, по якому Ви зможете відслідковувати замовлення 🌏\n⠀\nДОСТАВКА МОЖЛИВА:\n🍓 на відділення Нової пошти;\n🍓 на відділення Укрпошти;\n🍓 самовивіз з майстерні м. Львів, вул. Угорська, 2\n⠀\n📌 ВАЖЛИВО! Перевіряйте товар відразу при отриманні у відділенні!\n⠀\nЗалишились питання?\n👉 пишіть нам у Messenger ✉\n👉 або звертайтесь за телефоном: (068) 099 49 06\n⠀\n#horondi #lviv #ukraine #Львів #Горонді #наплічники #рюкзак #бананки #рюкзакльвів #рюкзакукраїна #рюкзакдляподорожей #рюкзакдляміста #рюкзакдлямам #рюкзаки #рюкзаккупити #бананки #бананочки #сумку #бананкальвів #рюкзакльвів #наплічник #сумкачерезплече #гаманець #щастя #любов #друзі #подарунок';

      const descriptionWithoutHashtags = description.slice(0, description.indexOf('#horondi')).trim();
      expect(IG_Class.removeHashtags(description)).toBe(descriptionWithoutHashtags.replace('#', ''));
    });
  });
    // create a user and set bio in order to set the socials
    beforeAll(async () => {
      const { user: u1, jwtToken: j1 } = await createUserAndLogin(user1);
      user1JwtToken = j1;
      user1._id = u1._id;

      return request(app)
        .put(`/api/users/${user1._id}`)
        .set('Authorization', user1JwtToken)
        .send({ instagram: 'horondi' })
        .expect(httpStatus.OK)
        .then(({ body }) => expect(body.scraping.instagram).toBe('horondi'));
    });
    // beforeEach(async () => {
    //   try {
    //     await Product.collection.deleteMany({}, { safe: true });
    //     await clearJobs();
    //   } catch (error) {
    //     console.error(error);
    //   }
    // });
    // afterEach(() => closeDBConnection());

    it('should created a Drop and a product', async done => {
      try {
        const waitFor = 15 * 1000; // seconds
        const interval = Math.floor(waitFor / 100);
        let totalTime = interval;

        // test a system message has been scheduled saying that the order has been confirmed
        // Check every 150ms for up to 15 seconds
        const timer = setInterval(async () => {
          totalTime += interval;

          // const emailMsg = instagramParams.Messages[0];
          // mock.onGet(`/_username_`).reply(200, { /* IG user profile */});

          const {
            body: { data: products },
          } = await request(app)
            .get('/api/products/')
            .expect(httpStatus.OK);

          if (products.length) {
            expect(products).toHaveLength(12);

            // GET User products

            const p = await Product.find({ uuid: products[0].uuid });
            expect(p.instagram).toBe('2100753171433006316');
            // expect(products[0].description.startsWith(i18n.orderConfirmed.slice(0, 10))).toBe(true);
            done();
            clearInterval(timer);
            return;
          }

          // it should not send a second confirmation system message - test this by using a long setTimeout

          if (totalTime >= waitFor) {
            clearInterval(timer);
            throw new Error('timeout to scrape IG');
          }
        }, interval);
      } catch (error) {
        console.error(error);
        done(error);
      }
    });
  });
});
