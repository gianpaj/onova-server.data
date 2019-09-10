import request from 'supertest';
import httpStatus from 'http-status';
// import nock from 'nock';
// import fs from 'fs';

import app from '../../index';
import { beforeAllTests, createUserAndLogin, sleep } from '../utils';
import { InstagramRunner } from '../../runners';
import { Product } from '../../models';

jest.setTimeout(50000);

describe('## Instagram Runner', () => {
  beforeAll(beforeAllTests);
  // nock.back.fixtures = path.join(__dirname, '__fixtures__');
  // nock.back.setMode('record');
  // nock.enableNetConnect();
  // nock.enableNetConnect(/(localhost|127.0.0.1|api.mailjet.com|127.0.0.1:(.+))/);

  let user1 = {
    username: 'userone',
    emailAddress: 'userone@gmail.com',
    password: 'expressos',
  };

  let user2 = {
    username: 'usertwo',
    emailAddress: 'usertwo@gmail.com',
    password: 'expressos',
  };

  let user1JwtToken, user2JwtToken;
  const IG_Class = new InstagramRunner();

  describe('Unit tests', () => {
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

    it('should extract the hashtags from post description (excluding #onova)', () => {
      const description =
        '📬 Відправку #здійснюємо по Україні 🇺🇦 та закордон 🛸\n⠀\nВартість доставки не включена в ціну товару.\n⠀\nВідправлення відбувається в тот самий день коли відбулась передоплата.\n⠀\nПісля відправки, надсилаємо фото декларації у Facebook/Instagram, по якому Ви зможете відслідковувати замовлення 🌏\n⠀\nДОСТАВКА МОЖЛИВА:\n🍓 на відділення Нової пошти;\n🍓 на відділення Укрпошти;\n🍓 самовивіз з майстерні м. Львів, вул. Угорська, 2\n⠀\n📌 ВАЖЛИВО! Перевіряйте товар відразу при отриманні у відділенні!\n⠀\nЗалишились питання?\n👉 пишіть нам у Messenger ✉\n👉 або звертайтесь за телефоном: (068) 099 49 06\n⠀\n#horondi #lviv #ukraine #Львів #Горонді #наплічники #рюкзак #бананки #рюкзакльвів #рюкзакукраїна #рюкзакдляподорожей #рюкзакдляміста #рюкзакдлямам #рюкзаки #рюкзаккупити #бананки #бананочки #сумку #бананкальвів #рюкзакльвів #наплічник #сумкачерезплече #гаманець #щастя #любов #друзі #подарунок #onova #ONOVA';
      const hashtags = description
        .slice(description.indexOf('#horondi'))
        .replace(/#/g, '')
        .split(/\s/)
        .slice(0, -2);
      expect(IG_Class.extractHashtags(description)).toEqual(['здійснюємо', ...hashtags]);
    });

    it('should remove the hashtags from the description', () => {
      const description =
        '📬 Відправку #здійснюємо по Україні 🇺🇦 та закордон 🛸\n⠀\nВартість доставки не включена в ціну товару.\n⠀\nВідправлення відбувається в тот самий день коли відбулась передоплата.\n⠀\nПісля відправки, надсилаємо фото декларації у Facebook/Instagram, по якому Ви зможете відслідковувати замовлення 🌏\n⠀\nДОСТАВКА МОЖЛИВА:\n🍓 на відділення Нової пошти;\n🍓 на відділення Укрпошти;\n🍓 самовивіз з майстерні м. Львів, вул. Угорська, 2\n⠀\n📌 ВАЖЛИВО! Перевіряйте товар відразу при отриманні у відділенні!\n⠀\nЗалишились питання?\n👉 пишіть нам у Messenger ✉\n👉 або звертайтесь за телефоном: (068) 099 49 06\n⠀\n#horondi #lviv #ukraine #Львів #Горонді #наплічники #рюкзак #бананки #рюкзакльвів #рюкзакукраїна #рюкзакдляподорожей #рюкзакдляміста #рюкзакдлямам #рюкзаки #рюкзаккупити #бананки #бананочки #сумку #бананкальвів #рюкзакльвів #наплічник #сумкачерезплече #гаманець #щастя #любов #друзі #подарунок';

      const descriptionWithoutHashtags = description.slice(0, description.indexOf('#horondi')).trim();
      expect(IG_Class.removeHashtags(description)).toBe(descriptionWithoutHashtags.replace('#', ''));
    });

    it('should extract the price from the description', () => {
      const description = '📬 Відправку #здійснюємо 100 UAH Україні 🇺🇦 та ';
      expect(IG_Class.extractPrice(description)).toBe('100');
      const description2 = 'Відправку #здійснюємо 100.00 UAH Україні $$';
      expect(IG_Class.extractPrice(description2)).toBe('100.00');
      const description3 = 'Відправку #здійснюємо 100 грн Україні €€';
      expect(IG_Class.extractPrice(description3)).toBe('100');
      const description4 = 'Відправку #здійснюємо ₴100 Україні';
      expect(IG_Class.extractPrice(description4)).toBe('100');
    });
  });

  describe('Scrape Instagram and create Product', () => {
    beforeAll(async () => {
      const { user: u1, jwtToken: j1 } = await createUserAndLogin(user1);
      const { user: u2, jwtToken: j2 } = await createUserAndLogin(user2);
      user1JwtToken = j1;
      user1._id = u1._id;
      user2JwtToken = j2;
      user2._id = u2._id;

      await request(app)
        .put(`/api/users/${user1._id}`)
        .set('Authorization', user1JwtToken)
        .send({ instagram: 'horondi' })
        .expect(httpStatus.OK)
        .then(({ body }) => expect(body.scraping.instagram).toBe('horondi'));

      return request(app)
        .put(`/api/users/${user2._id}`)
        .set('Authorization', user2JwtToken)
        .send({ instagram: 'gianpaj' })
        .expect(httpStatus.OK)
        .then(({ body }) => expect(body.scraping.instagram).toBe('gianpaj'));
    });

    it('should created a Drop and a product', async done => {
      await sleep(1000);
      await IG_Class.scrape();
      try {
        const p = await Product.findOne({});
        console.log(p);
        // console.log(products);
        // expect(p.instagram).toBe('2060899296590629529');

        done();
      } catch (error) {
        console.error(error);
        done(error);
      }
    });
  });
});
