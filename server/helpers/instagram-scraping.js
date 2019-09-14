// https://github.com/rzlyp/instagram-scraping/commit/76d70f7de251fa85a67135945ed690c21dfc0803

// Gian changed:
// - added scrapeUserPageDeep

var request = require('request'),
  BluePromise = require('bluebird'),
  async = require('async'),
  userURL = 'https://www.instagram.com/',
  listURL = 'https://www.instagram.com/explore/tags/',
  postURL = 'https://www.instagram.com/p/',
  locURL = 'https://www.instagram.com/explore/locations/',
  dataExp = /window\._sharedData\s?=\s?({.+);<\/script>/;

const debug = require('debug')('server-data:instagram');
// const debug = console.log;

exports.scrapeUserPage = function (username) {
  return new Promise(function (resolve, reject) {
    if (!username) return reject(new Error('Argument "username" must be specified'));
    request(userURL + username, function (err, response, body) {
      var data = scrape(body);
      if (
        data &&
        data.entry_data &&
        data.entry_data.ProfilePage &&
        data.entry_data.ProfilePage[0] &&
        data.entry_data.ProfilePage[0].graphql &&
        data.entry_data.ProfilePage[0].graphql.user &&
        data.entry_data.ProfilePage[0].graphql.user.edge_owner_to_timeline_media &&
        data.entry_data.ProfilePage[0].graphql.user.edge_owner_to_timeline_media.count > 0 &&
        data.entry_data.ProfilePage[0].graphql.user.edge_owner_to_timeline_media.edges
      ) {
        var edges = data.entry_data.ProfilePage[0].graphql.user.edge_owner_to_timeline_media.edges;
        async.waterfall(
          [
            callback => {
              var medias = [];
              edges.forEach(post => {
                if (post.node.__typename === 'GraphImage') {
                  medias.push(exports.scrapePostData(post));
                }
              });
              callback(null, medias);
            },
          ],
          (err, results) => {
            resolve({
              total: results.length,
              medias: results,
            });
          }
        );
      } else {
        reject(new Error('Error scraping user page "' + username + '"'));
      }
    });
  });
};

exports.scrapeUserPageDeep = function (username, toFilter) {
  return new Promise((resolve, reject) => {
    if (!username) return reject(new Error('Argument "username" must be specified'));
    request(userURL + username, function (err, response, body) {
      if (err || response.statusCode > 200) {
        return reject(err || response.statusCode);
      }
      var data = scrape(body);
      if (
        data &&
        data.entry_data &&
        data.entry_data.ProfilePage &&
        data.entry_data.ProfilePage[0] &&
        data.entry_data.ProfilePage[0].graphql &&
        data.entry_data.ProfilePage[0].graphql.user &&
        data.entry_data.ProfilePage[0].graphql.user.edge_owner_to_timeline_media &&
        data.entry_data.ProfilePage[0].graphql.user.edge_owner_to_timeline_media.count > 0 &&
        data.entry_data.ProfilePage[0].graphql.user.edge_owner_to_timeline_media.edges
      ) {
        let { edges } = data.entry_data.ProfilePage[0].graphql.user.edge_owner_to_timeline_media;
        if (toFilter && toFilter.length) edges = edges.filter(edge => toFilter.indexOf(edge.node.id) < 0);
        const promises = BluePromise.map(edges, edge =>
          exports
            .scrapePostCode(edge.node.shortcode)
            .delay(exports.getRandomArbitrary(1000, 1500))
            .then(postPage => exports.preparePostFields(postPage))
            .catch(err => {
              console.log('An error occurred calling scrapePostPage inside deepScrapeTagPage' + ':' + err);
              return err;
            })
        );

        // #region
        // return resolve({
        //   username: 'ga.eva.wear',
        //   instagramOwnerId: '4924240195',
        //   total: 1,
        //   medias: [
        //     {
        //       __typename: 'GraphImage',
        //       id: '2100753171433006316',
        //       shortcode: 'B0nX-EQCiTs',
        //       dimensions: { height: 1080, width: 1080 },
        //       gating_info: null,
        //       media_preview:
        //         'ACoq6aiiigBrEgfKMn0PFMWUE4IIJ/8A1EZ9fb8qWTJGAcZ4GOtRG32oBHkMOhJJz9fr/OgCzRSCloAKKKSgCs8JLDkkc5zgkHtjj61YUEDDcn1qu4bJK7uAD19+mPpVqgAooooAKgZmZig+UEfe9+On4Gp6SgBqAqMHHHpT6KKACiiigD//2Q==',
        //       display_url:
        //         'https://scontent-waw1-1.cdninstagram.com/vp/e0f85a3390e6a5105a5b2d4e44baa830/5E0DE0FB/t51.2885-15/e35/s1080x1080/67106714_666066740577506_7844765260108957182_n.jpg?_nc_ht=scontent-waw1-1.cdninstagram.com',
        //       display_resources: [
        //         {
        //           src:
        //             'https://scontent-waw1-1.cdninstagram.com/vp/9bba422902ead94389eb3d4c07dfb581/5DF2BA4C/t51.2885-15/sh0.08/e35/s640x640/67106714_666066740577506_7844765260108957182_n.jpg?_nc_ht=scontent-waw1-1.cdninstagram.com',
        //           config_width: 640,
        //           config_height: 640,
        //         },
        //         {
        //           src:
        //             'https://scontent-waw1-1.cdninstagram.com/vp/7584c9b5e8e107b01c682721d08863d2/5E0BD94C/t51.2885-15/sh0.08/e35/s750x750/67106714_666066740577506_7844765260108957182_n.jpg?_nc_ht=scontent-waw1-1.cdninstagram.com',
        //           config_width: 750,
        //           config_height: 750,
        //         },
        //         {
        //           src:
        //             'https://scontent-waw1-1.cdninstagram.com/vp/e0f85a3390e6a5105a5b2d4e44baa830/5E0DE0FB/t51.2885-15/e35/s1080x1080/67106714_666066740577506_7844765260108957182_n.jpg?_nc_ht=scontent-waw1-1.cdninstagram.com',
        //           config_width: 1080,
        //           config_height: 1080,
        //         },
        //       ],
        //       accessibility_caption: 'No photo description available.',
        //       is_video: false,
        //       should_log_client_event: false,
        //       tracking_token:
        //         'eyJ2ZXJzaW9uIjo1LCJwYXlsb2FkIjp7ImlzX2FuYWx5dGljc190cmFja2VkIjp0cnVlLCJ1dWlkIjoiNGI3NWRlZGJhZWZkNDI2NjhkM2UyMDA0ODk5M2Q1NjUyMTAwNzUzMTcxNDMzMDA2MzE2In0sInNpZ25hdHVyZSI6IiJ9',
        //       edge_media_to_tagged_user: { edges: [] },
        //       edge_media_to_caption: { edges: [{ node: { text: 'Графіка ◼️\n@alina_haieva' } }] },
        //       caption_is_edited: false,
        //       has_ranked_comments: false,
        //       edge_media_to_parent_comment: {
        //         count: 0,
        //         page_info: { has_next_page: false, end_cursor: null },
        //         edges: [],
        //       },
        //       edge_media_preview_comment: { count: 0, edges: [] },
        //       comments_disabled: false,
        //       taken_at_timestamp: 1564649314,
        //       edge_media_preview_like: { count: 20, edges: [] },
        //       edge_media_to_sponsor_user: { edges: [] },
        //       location: {
        //         id: '212898659',
        //         has_public_page: true,
        //         name: 'Kyiv, Ukraine',
        //         slug: 'kyiv-ukraine',
        //         address_json:
        //           '{"street_address": "", "zip_code": "", "city_name": "Kyiv, Ukraine", "region_name": "", "country_code": "UA", "exact_city_match": true, "exact_region_match": false, "exact_country_match": false}',
        //       },
        //       viewer_has_liked: false,
        //       viewer_has_saved: false,
        //       viewer_has_saved_to_collection: false,
        //       viewer_in_photo_of_you: false,
        //       viewer_can_reshare: true,
        //       owner: {
        //         id: '4924240195',
        //         is_verified: false,
        //         profile_pic_url:
        //           'https://scontent-waw1-1.cdninstagram.com/vp/5caa58a2a5a5b5441390de9d5017e3d7/5E0CE3C2/t51.2885-19/s150x150/26067212_581603742231335_2981870054150242304_n.jpg?_nc_ht=scontent-waw1-1.cdninstagram.com',
        //         username: 'ga.eva.wear',
        //         blocked_by_viewer: false,
        //         followed_by_viewer: false,
        //         full_name: 'GA.EVA',
        //         has_blocked_viewer: false,
        //         is_private: false,
        //         is_unpublished: false,
        //         requested_by_viewer: false,
        //       },
        //       is_ad: false,
        //       edge_web_media_to_related_media: { edges: [] },
        //     },
        //   ],
        // });

        // return resolve({
        //   username: 'ga.eva.wear',
        //   instagramOwnerId: '4924240195',
        //   total: 1,
        //   medias: [
        // {
        //   __typename: 'GraphSidecar',
        //   id: '2124707402908642379',
        //   shortcode: 'B18eiAyAyxL',
        //   dimensions: { height: 1080, width: 1080 },
        //   gating_info: null,
        //   media_preview: null,
        //   display_url:
        //     'https://instagram.fiev21-1.fna.fbcdn.net/vp/11e03ce494d1ff8356d80808c54ee5f3/5E0AF8BB/t51.2885-15/e35/69645493_137116330851407_1194381250125621828_n.jpg?_nc_ht=instagram.fiev21-1.fna.fbcdn.net',
        //   display_resources: [
        //     {
        //       src:
        //         'https://instagram.fiev21-1.fna.fbcdn.net/vp/0e5df2aa009bab08dea770bda92951d0/5E05905E/t51.2885-15/sh0.08/e35/s640x640/69645493_137116330851407_1194381250125621828_n.jpg?_nc_ht=instagram.fiev21-1.fna.fbcdn.net',
        //       config_width: 640,
        //       config_height: 640,
        //     },
        //     {
        //       src:
        //         'https://instagram.fiev21-1.fna.fbcdn.net/vp/ec951a5092f20cf19e9777ce117db6c4/5E0F775E/t51.2885-15/sh0.08/e35/s750x750/69645493_137116330851407_1194381250125621828_n.jpg?_nc_ht=instagram.fiev21-1.fna.fbcdn.net',
        //       config_width: 750,
        //       config_height: 750,
        //     },
        //     {
        //       src:
        //         'https://instagram.fiev21-1.fna.fbcdn.net/vp/11e03ce494d1ff8356d80808c54ee5f3/5E0AF8BB/t51.2885-15/e35/69645493_137116330851407_1194381250125621828_n.jpg?_nc_ht=instagram.fiev21-1.fna.fbcdn.net',
        //       config_width: 1080,
        //       config_height: 1080,
        //     },
        //   ],
        //   is_video: false,
        //   should_log_client_event: false,
        //   tracking_token:
        //     'eyJ2ZXJzaW9uIjo1LCJwYXlsb2FkIjp7ImlzX2FuYWx5dGljc190cmFja2VkIjp0cnVlLCJ1dWlkIjoiYTJjYmZlYjVkZTRlNGUxYzk5MzI3NmE2YTI4Nzg1ZDgyMTI0NzA3NDAyOTA4NjQyMzc5In0sInNpZ25hdHVyZSI6IiJ9',
        //   edge_media_to_tagged_user: { edges: [] },
        //   edge_media_to_caption: {
        //     edges: [
        //       {
        //         node: {
        //           text:
        //             "Бананка 🍎  вже стала незамінною річчю у побуті 😏\n⠀\nадже це зручно, а з бананками від Horondi це щей красиво, стильно і завжди яскраво 🖤❤\n⠀\n📏 Розмір: 17х35 см\n⠀\nНаші #бананки із якісного, міцного матеріалу. ⠀\n✅ Вмістка;\n✅ Ззовні є кишеня для дрібничок;\n✅ Всередині кишеня на липучці;\n⠀\nДодайте трішки Horondi в своє життя і воно обов'язково стане яскравішим🖤💜🧡💛💚💙❤\n⠀\n🍎 Також Ви можете обрати колір тканини та різновид габалену для Вашої майбутньої бананки;\n⠀\n🍎 Ціна 400 грн.*\n⠀\n* При змінні тканини/габалену, просимо ціну уточнювати у менеджерів 💚\n⠀\nЗалишились питання?\n👉 пишіть нам у Messenger ✉\n👉 або звертайтесь за телефоном: (068) 099 49 06\n⠀\n#horondi #lviv #ukraine #Львів #Горонді #наплічники #рюкзак #бананки #рюкзакльвів #рюкзакукраїна #рюкзакдляподорожей #рюкзакдляміста #рюкзакдлямам #рюкзаки #рюкзаккупити #бананки #бананочки #сумку #бананкальвів #рюкзакльвів #наплічник #сумкачерезплече #гаманець #щастя #любов #друзі #подарунок #деньнародження",
        //         },
        //       },
        //     ],
        //   },
        //   caption_is_edited: true,
        //   has_ranked_comments: false,
        //   edge_media_to_parent_comment: {
        //     count: 1,
        //     page_info: { has_next_page: false, end_cursor: null },
        //     edges: [
        //       {
        //         node: {
        //           id: '17888044135400406',
        //           text: '@mariyafediy 🛸',
        //           created_at: 1567505441,
        //           did_report_as_spam: false,
        //           owner: {
        //             id: '378745076',
        //             is_verified: false,
        //             profile_pic_url:
        //               'https://instagram.fiev21-1.fna.fbcdn.net/vp/6dd172dac0bfa7b60b1b12e534025ddd/5E10B177/t51.2885-19/s150x150/56213900_283598129219328_5871313249609187328_n.jpg?_nc_ht=instagram.fiev21-1.fna.fbcdn.net',
        //             username: 'helgalviv',
        //           },
        //           viewer_has_liked: false,
        //           edge_liked_by: { count: 0 },
        //           edge_threaded_comments: {
        //             count: 0,
        //             page_info: { has_next_page: false, end_cursor: null },
        //             edges: [],
        //           },
        //         },
        //       },
        //     ],
        //   },
        //   edge_media_preview_comment: {
        //     count: 1,
        //     edges: [
        //       {
        //         node: {
        //           id: '17888044135400406',
        //           text: '@mariyafediy 🛸',
        //           created_at: 1567505441,
        //           did_report_as_spam: false,
        //           owner: {
        //             id: '378745076',
        //             is_verified: false,
        //             profile_pic_url:
        //               'https://instagram.fiev21-1.fna.fbcdn.net/vp/6dd172dac0bfa7b60b1b12e534025ddd/5E10B177/t51.2885-19/s150x150/56213900_283598129219328_5871313249609187328_n.jpg?_nc_ht=instagram.fiev21-1.fna.fbcdn.net',
        //             username: 'helgalviv',
        //           },
        //           viewer_has_liked: false,
        //           edge_liked_by: { count: 0 },
        //         },
        //       },
        //     ],
        //   },
        //   comments_disabled: false,
        //   taken_at_timestamp: 1567504881,
        //   edge_media_preview_like: { count: 178, edges: [] },
        //   edge_media_to_sponsor_user: { edges: [] },
        //   location: null,
        //   viewer_has_liked: false,
        //   viewer_has_saved: false,
        //   viewer_has_saved_to_collection: false,
        //   viewer_in_photo_of_you: false,
        //   viewer_can_reshare: true,
        //   owner: {
        //     id: '3985344614',
        //     is_verified: false,
        //     profile_pic_url:
        //       'https://instagram.fiev21-1.fna.fbcdn.net/vp/b22b31b2005ba60a19f59050d8d4e0cc/5E095582/t51.2885-19/s150x150/66204338_502288056980642_3249027594170925056_n.jpg?_nc_ht=instagram.fiev21-1.fna.fbcdn.net',
        //     username: 'horondi',
        //     blocked_by_viewer: false,
        //     followed_by_viewer: false,
        //     full_name: 'HORONDI',
        //     has_blocked_viewer: false,
        //     is_private: false,
        //     is_unpublished: false,
        //     requested_by_viewer: false,
        //   },
        //   is_ad: false,
        //   edge_web_media_to_related_media: { edges: [] },
        //   edge_sidecar_to_children: {
        //     edges: [
        //       {
        //         node: {
        //           __typename: 'GraphImage',
        //           id: '2124707399838442642',
        //           shortcode: 'B18eh97A6SS',
        //           dimensions: { height: 1080, width: 1080 },
        //           gating_info: null,
        //           media_preview:
        //             'ACoqfJdNfYBUx7RuGGzkNx6D0rMuIJFPUkVbtXCDc3RYk/m3SqTXbvlf7/6D0/KhK4+yRClu7ZJPA9xn8v61dtWeLah5SRwB7EEf0qmybiOSM8CoEdom44Kn9RSaNGuVnTX9o7EOmD2K9z7istbSUADaenpV+3uPPGTncOoP+ehq4N2KtRXQwb1K93psUShVZlDcHnOQOg56AZ7VUNnHBh0G8dyxPB+g/P3FX9ZyTEq85ZvywP0qgt6Y3w4IOMc9GH90nv8A7LdR0PrUNmsbfMgnTzBwcAYzx0/2sD8jxwKz2Hm/N/EOvv7itdwFbCH5D0z1GRkq34fhVGdNjbhxnOPYZ4B+nb2qimtbrZ7r+v6+RFFK0fKHqMZq6lxKVBy3QVmPxyOhroI7lAgHzDgcAnA46DnpRfsZ8tnqaGp9F+p/pWFct+6I6ngfrW5qgyF+p/pWFOBsP1FZ9SblJJJiSAc8AfNzwOn5dqd5UjcsRUsIGPxq7tHHArawczWzMp7eTgDBzVpI32jp0FXCo9O1SoBtH0FRLTYV29z/2Q==',
        //           display_url:
        //             'https://instagram.fiev21-1.fna.fbcdn.net/vp/11e03ce494d1ff8356d80808c54ee5f3/5E0AF8BB/t51.2885-15/e35/69645493_137116330851407_1194381250125621828_n.jpg?_nc_ht=instagram.fiev21-1.fna.fbcdn.net',
        //           display_resources: [
        //             {
        //               src:
        //                 'https://instagram.fiev21-1.fna.fbcdn.net/vp/0e5df2aa009bab08dea770bda92951d0/5E05905E/t51.2885-15/sh0.08/e35/s640x640/69645493_137116330851407_1194381250125621828_n.jpg?_nc_ht=instagram.fiev21-1.fna.fbcdn.net',
        //               config_width: 640,
        //               config_height: 640,
        //             },
        //             {
        //               src:
        //                 'https://instagram.fiev21-1.fna.fbcdn.net/vp/ec951a5092f20cf19e9777ce117db6c4/5E0F775E/t51.2885-15/sh0.08/e35/s750x750/69645493_137116330851407_1194381250125621828_n.jpg?_nc_ht=instagram.fiev21-1.fna.fbcdn.net',
        //               config_width: 750,
        //               config_height: 750,
        //             },
        //             {
        //               src:
        //                 'https://instagram.fiev21-1.fna.fbcdn.net/vp/11e03ce494d1ff8356d80808c54ee5f3/5E0AF8BB/t51.2885-15/e35/69645493_137116330851407_1194381250125621828_n.jpg?_nc_ht=instagram.fiev21-1.fna.fbcdn.net',
        //               config_width: 1080,
        //               config_height: 1080,
        //             },
        //           ],
        //           accessibility_caption: 'Image may contain: one or more people and stripes',
        //           is_video: false,
        //           should_log_client_event: false,
        //           tracking_token:
        //             'eyJ2ZXJzaW9uIjo1LCJwYXlsb2FkIjp7ImlzX2FuYWx5dGljc190cmFja2VkIjp0cnVlLCJ1dWlkIjoiYTJjYmZlYjVkZTRlNGUxYzk5MzI3NmE2YTI4Nzg1ZDgyMTI0NzA3Mzk5ODM4NDQyNjQyIn0sInNpZ25hdHVyZSI6IiJ9',
        //           edge_media_to_tagged_user: { edges: [] },
        //         },
        //       },
        //       {
        //         node: {
        //           __typename: 'GraphImage',
        //           id: '2124707399846792012',
        //           shortcode: 'B18eh97gwtM',
        //           dimensions: { height: 1080, width: 1080 },
        //           gating_info: null,
        //           media_preview:
        //             'ACoq3b3/AFEn+438jXNwpiNSTjgV0t2MwuP9hv5GuRmnMaKmOeD78YxSGjVSEOwXnBzkj6Gq4h8uVxyVxwT355/Ko7XUMZZ1JK8jb7g9c/nUkVx5p56k5zyAQeeh/I07aWDrc2tPGIz/ALx/kKv1R0/7h/3j/IVeoERT/wCrb/dP8q4e6YswY88kAf5/Su3uTiJz/st/I1w3DOo/2hQMsW4ypbjD5GPTA6/r+lTWkrO2xsYABHHpVaAhePQkfqas2uFZT6xf+zGi+4jpbL7h+v8AQVcqlYsGQ4/vf0FXaSGyvd/6l8/3G/ka4tI1yWOeOg967O8/1En+438jXEjpSZDJCuD8pyDz7g9+vpT0JBGQB8uOvv8A5NV8mnDtU3YrnU6QcxMf9s/yFatZOjf6k/75/kK1qtbFI//Z',
        //           display_url:
        //             'https://instagram.fiev21-1.fna.fbcdn.net/vp/8928d29f53369e9562882ead4c7e4fdf/5DFA9388/t51.2885-15/e35/67813161_505092386951900_5135268035090782769_n.jpg?_nc_ht=instagram.fiev21-1.fna.fbcdn.net',
        //           display_resources: [
        //             {
        //               src:
        //                 'https://instagram.fiev21-1.fna.fbcdn.net/vp/f312dfd24f6fdd3da46f83d57a67a87f/5DF1A46D/t51.2885-15/sh0.08/e35/s640x640/67813161_505092386951900_5135268035090782769_n.jpg?_nc_ht=instagram.fiev21-1.fna.fbcdn.net',
        //               config_width: 640,
        //               config_height: 640,
        //             },
        //             {
        //               src:
        //                 'https://instagram.fiev21-1.fna.fbcdn.net/vp/bc1bbcfc9149f4b0ec54c9de9d405a06/5DF7A76D/t51.2885-15/sh0.08/e35/s750x750/67813161_505092386951900_5135268035090782769_n.jpg?_nc_ht=instagram.fiev21-1.fna.fbcdn.net',
        //               config_width: 750,
        //               config_height: 750,
        //             },
        //             {
        //               src:
        //                 'https://instagram.fiev21-1.fna.fbcdn.net/vp/8928d29f53369e9562882ead4c7e4fdf/5DFA9388/t51.2885-15/e35/67813161_505092386951900_5135268035090782769_n.jpg?_nc_ht=instagram.fiev21-1.fna.fbcdn.net',
        //               config_width: 1080,
        //               config_height: 1080,
        //             },
        //           ],
        //           accessibility_caption: 'Image may contain: one or more people, people standing and outdoor',
        //           is_video: false,
        //           should_log_client_event: false,
        //           tracking_token:
        //             'eyJ2ZXJzaW9uIjo1LCJwYXlsb2FkIjp7ImlzX2FuYWx5dGljc190cmFja2VkIjp0cnVlLCJ1dWlkIjoiYTJjYmZlYjVkZTRlNGUxYzk5MzI3NmE2YTI4Nzg1ZDgyMTI0NzA3Mzk5ODQ2NzkyMDEyIn0sInNpZ25hdHVyZSI6IiJ9',
        //           edge_media_to_tagged_user: { edges: [] },
        //         },
        //       },
        //       {
        //         node: {
        //           __typename: 'GraphImage',
        //           id: '2124707399855049939',
        //           shortcode: 'B18eh98AQzT',
        //           dimensions: { height: 1080, width: 1080 },
        //           gating_info: null,
        //           media_preview:
        //             'ACoq6AXEbchlI9iKGuYlG5nUD1JGPzrjY3KHAyp9QeD+BrUickEsFyevBGfw6ZqbmijfqbouYTyHT/vof40n2uHp5if99D/GuWWyVicNgZ4Bx+IOOR/hzTXg8rG4YHYr0/P/ABxQpRbtfUhpo6w3UI6uv/fQ/wAaPtUP99P++h/jXHStyuBnnP4D1q6bNnO4AYbkcdjzVPQErlBsrhlOOx7jB9RTROHADEoR/d4H6CrLRAxtj0z+VZqDf061HLpZjW1jRUBfnMkbZH8Q5/Q9frVOSZ+RvG09h0/I0xS6ZC5GeuKEjMh9z3PT8TSULb6/JANjUyMFHc4+lbYVlGATgcDms2E4dQO3WtTeasNjXGmRAYy35j/Cqo0GBTkM/wCY/wDia26KZJk/2ND13P8AmP8ACj+x4sYDOM+4/wAK1qKB3ZkR6JDGcgufqR/hU/8AZsfq35j/AArQooEf/9k=',
        //           display_url:
        //             'https://instagram.fiev21-1.fna.fbcdn.net/vp/187a23c1b0324faae354c425aba246b9/5DF1D50B/t51.2885-15/e35/68968990_196039564739010_4054192401270022320_n.jpg?_nc_ht=instagram.fiev21-1.fna.fbcdn.net',
        //           display_resources: [
        //             {
        //               src:
        //                 'https://instagram.fiev21-1.fna.fbcdn.net/vp/014a1b9c764625f36e0da9592d828f4e/5E05ADEE/t51.2885-15/sh0.08/e35/s640x640/68968990_196039564739010_4054192401270022320_n.jpg?_nc_ht=instagram.fiev21-1.fna.fbcdn.net',
        //               config_width: 640,
        //               config_height: 640,
        //             },
        //             {
        //               src:
        //                 'https://instagram.fiev21-1.fna.fbcdn.net/vp/af7606742e36107e9a24b25dd1573e13/5E1432EE/t51.2885-15/sh0.08/e35/s750x750/68968990_196039564739010_4054192401270022320_n.jpg?_nc_ht=instagram.fiev21-1.fna.fbcdn.net',
        //               config_width: 750,
        //               config_height: 750,
        //             },
        //             {
        //               src:
        //                 'https://instagram.fiev21-1.fna.fbcdn.net/vp/187a23c1b0324faae354c425aba246b9/5DF1D50B/t51.2885-15/e35/68968990_196039564739010_4054192401270022320_n.jpg?_nc_ht=instagram.fiev21-1.fna.fbcdn.net',
        //               config_width: 1080,
        //               config_height: 1080,
        //             },
        //           ],
        //           accessibility_caption: 'No photo description available.',
        //           is_video: false,
        //           should_log_client_event: false,
        //           tracking_token:
        //             'eyJ2ZXJzaW9uIjo1LCJwYXlsb2FkIjp7ImlzX2FuYWx5dGljc190cmFja2VkIjp0cnVlLCJ1dWlkIjoiYTJjYmZlYjVkZTRlNGUxYzk5MzI3NmE2YTI4Nzg1ZDgyMTI0NzA3Mzk5ODU1MDQ5OTM5In0sInNpZ25hdHVyZSI6IiJ9',
        //           edge_media_to_tagged_user: { edges: [] },
        //         },
        //       },
        //       {
        //         node: {
        //           __typename: 'GraphImage',
        //           id: '2124707399821557144',
        //           shortcode: 'B18eh96Af2Y',
        //           dimensions: { height: 1080, width: 1080 },
        //           gating_info: null,
        //           media_preview:
        //             'ACoq6D7REf41/MU37XDjPmJjp94f41zIcEYHpUUkJWMbR8uckgdOMc+lC1A6sXcJ/jT/AL6H+NL9qhHO9eeB8w6/nXHIuKndfkXvhgf/AK/51VhXOoN5ADgyICP9of40n223/wCeif8AfS/41yl7asJSxAw2Dj6iqfkmouFzTiiPt+dDXJtnwDhSMkevNRxsSaq3py4I9P6np7VlG7eoJ6itdjJ2KMHnnqD/AJ6U+zDNJ5h5IHGfX6f0quHQ8kfXj/69WrY+azY4GK1d7aFt/wDA/qxbnlLkM/Jxjj/9VQ4HpVry1Aweai2L/nNZ8rerItfVmuujwr0Z/wAx/hTJNEhkOSz8ehH+FbFFaWQWMb+woNpXL8kHqO3/AAH3qSDSIYCSpY59SP8ACtWimMpGwjPr+n+FM/s2P1b8x/hWhRQB/9k=',
        //           display_url:
        //             'https://instagram.fiev21-1.fna.fbcdn.net/vp/650ac25692520aacd56128056e428f1b/5E13FBFE/t51.2885-15/e35/67664716_139307203958838_661493964375068992_n.jpg?_nc_ht=instagram.fiev21-1.fna.fbcdn.net',
        //           display_resources: [
        //             {
        //               src:
        //                 'https://instagram.fiev21-1.fna.fbcdn.net/vp/d235982d367736ab2594368fa2b33381/5E0AB78D/t51.2885-15/sh0.08/e35/s640x640/67664716_139307203958838_661493964375068992_n.jpg?_nc_ht=instagram.fiev21-1.fna.fbcdn.net',
        //               config_width: 640,
        //               config_height: 640,
        //             },
        //             {
        //               src:
        //                 'https://instagram.fiev21-1.fna.fbcdn.net/vp/7990401193afd306dae52645499ce830/5DF22F72/t51.2885-15/sh0.08/e35/s750x750/67664716_139307203958838_661493964375068992_n.jpg?_nc_ht=instagram.fiev21-1.fna.fbcdn.net',
        //               config_width: 750,
        //               config_height: 750,
        //             },
        //             {
        //               src:
        //                 'https://instagram.fiev21-1.fna.fbcdn.net/vp/650ac25692520aacd56128056e428f1b/5E13FBFE/t51.2885-15/e35/67664716_139307203958838_661493964375068992_n.jpg?_nc_ht=instagram.fiev21-1.fna.fbcdn.net',
        //               config_width: 1080,
        //               config_height: 1080,
        //             },
        //           ],
        //           accessibility_caption: 'Image may contain: one or more people and outdoor',
        //           is_video: false,
        //           should_log_client_event: false,
        //           tracking_token:
        //             'eyJ2ZXJzaW9uIjo1LCJwYXlsb2FkIjp7ImlzX2FuYWx5dGljc190cmFja2VkIjp0cnVlLCJ1dWlkIjoiYTJjYmZlYjVkZTRlNGUxYzk5MzI3NmE2YTI4Nzg1ZDgyMTI0NzA3Mzk5ODIxNTU3MTQ0In0sInNpZ25hdHVyZSI6IiJ9',
        //           edge_media_to_tagged_user: { edges: [] },
        //         },
        //       },
        //     ],
        //   },
        // }
        //   ],
        // });
        // #endregion

        promises.then(results => {
          results = results.filter(result => !(result instanceof Error));
          resolve({
            username,
            instagramOwnerId: results.length ? results[0].instagramOwnerId : null,
            total: results.length,
            medias: results,
          });
        });
      } else {
        console.debug(JSON.stringify(data, null, 2));
        reject(new Error('Error scraping user page "' + username + '"'));
      }
    });
  });
};

exports.deepScrapeTagPage = function (tag) {
  return new Promise(function (resolve, reject) {
    exports
      .scrapeTag(tag)
      .then(function (tagPage) {
        return Promise.map(tagPage.medias, function (media, i, len) {
          return exports
            .scrapePostCode(media.shortcode)
            .then(function (postPage) {
              tagPage.medias[i] = postPage;
              if (typeof postPage.location !== 'undefined' && postPage.location.has_public_page) {
                return exports
                  .scrapeLocation(postPage.location.id)
                  .then(function (locationPage) {
                    tagPage.media[i].location = locationPage;
                  })
                  .catch(function (err) {
                    console.log('An error occurred calling scrapeLocation inside deepScrapeTagPage' + ':' + err);
                  });
              }
            })
            .catch(function (err) {
              console.log('An error occurred calling scrapePostPage inside deepScrapeTagPage' + ':' + err);
            });
        })
          .then(function () {
            resolve(tagPage);
          })
          .catch(function (err) {
            console.log('An error occurred resolving tagPage inside deepScrapeTagPage' + ':' + err);
          });
      })
      .catch(function (err) {
        console.log('An error occurred calling scrapeTagPage inside deepScrapeTagPage' + ':' + err);
      });
  });
};

exports.scrapeTag = function (tag) {
  return new Promise(function (resolve, reject) {
    if (!tag) return reject(new Error('Argument "tag" must be specified'));
    var options = {
      url: listURL + tag,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 8_0 like Mac OS X) AppleWebKit/600.1.3 (KHTML, like Gecko) Version/8.0 Mobile/12A4345d Safari/600.1.4',
      },
    };
    request(options, function (err, response, body) {
      if (err) return reject(err);

      var data = scrape(body);
      var media =
        data.entry_data && data.entry_data.TagPage && data.entry_data.TagPage[0].graphql.hashtag.edge_hashtag_to_media;

      if (data && media) {
        var edges = media.edges;

        async.waterfall(
          [
            callback => {
              var medias = [];
              edges.forEach(post => {
                medias.push(exports.scrapePostData(post));
              });
              callback(null, medias);
            },
          ],
          (err, results) => {
            resolve({
              total: results.length,
              medias: results,
            });
          }
        );
      } else {
        reject(new Error('Error scraping tag page "' + tag + '"'));
      }
    });
  });
};

exports.scrapePostData = function (post) {
  return {
    media_id: post.node.id,
    shortcode: post.node.shortcode,
    text: post.node.edge_media_to_caption.edges[0] && post.node.edge_media_to_caption.edges[0].node.text,
    comment_count: post.node.edge_media_to_comment.count,
    like_count: post.node.edge_liked_by.count,
    display_url: post.node.display_url,
    owner_id: post.node.owner.id,
    date: post.node.taken_at_timestamp,
    thumbnail: post.node.thumbnail_src,
    thumbnail_resource: post.node.thumbnail_resources,
  };
};

exports.preparePostFields = media => {
  let images;

  if (!media.description) {
    throw new Error(`${media.shortcode} by ${media.owner.username} has an empty description`);
  }
  if (media.is_video) {
    throw new Error(`${media.shortcode} by ${media.owner.username} is a video`);
  }

  // if album
  if (media.edge_sidecar_to_children) {
    // ignore videos
    const edges = media.edge_sidecar_to_children.edges.filter(i => !i.node.is_video);
    images = edges.map(edge => largestImage(edge.node.display_resources).src);
  } else {
    images = [largestImage(media.display_resources).src];
  }
  return {
    instagramId: media.id,
    instagramOwnerId: media.owner.id,
    shortcode: media.shortcode,
    username: media.owner.username,
    timestamp: media.taken_at_timestamp,
    // extra fields. These won't be inserted in the db
    ...{ location: media.location ? JSON.parse(media.location.address_json).city_name : {} },
    description: media.edge_media_to_caption.edges[0] && media.edge_media_to_caption.edges[0].node.text,
    images,
  };
};

/**
 * Get the largest image (resource object) based on a field (config_height)
 *
 * @param {Array<any>} array of object resources
 */
function largestImage(array) {
  return array.reduce((acc, cur) => (acc.config_height > cur.config_height ? acc : cur));
}

exports.scrapePostCode = function (code) {
  debug('scraping %j', code);
  return new BluePromise(function (resolve, reject) {
    if (!code) return reject(new Error('Argument "code" must be specified'));

    request(postURL + code, function (err, response, body) {
      var data = scrape(body);
      if (
        data &&
        data.entry_data &&
        data.entry_data.PostPage[0] &&
        data.entry_data.PostPage[0].graphql &&
        data.entry_data.PostPage[0].graphql.shortcode_media
      ) {
        resolve(data.entry_data.PostPage[0].graphql.shortcode_media);
      } else {
        reject(new Error('Error scraping post page "' + code + '"'));
      }
    });
  });
};

exports.scrapeLocation = function (id) {
  return new Promise(function (resolve, reject) {
    if (!id) return reject(new Error('Argument "id" must be specified'));

    request(locURL + id, function (err, response, body) {
      var data = scrape(body);

      if (data && data.entry_data && typeof data.entry_data.LocationsPage !== 'undefined') {
        resolve(data.entry_data.LocationsPage[0].location);
      } else {
        reject(new Error('Error scraping location page "' + id + '"'));
      }
    });
  });
};

var scrape = function (html) {
  try {
    var dataString = html.match(dataExp)[1];
    var json = JSON.parse(dataString);
  } catch (e) {
    if (process.env.NODE_ENV === 'production') {
      console.error('The HTML returned from instagram was not suitable for scraping');
    } else {
      console.error(html);
    }
    return null;
  }

  return json;
};

exports.getRandomArbitrary = function (min, max) {
  return Math.floor(Math.random() * (max - min) + min);
};
