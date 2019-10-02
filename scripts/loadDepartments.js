const axios = require('axios');
const mongoose = require('mongoose');
const throat = require('throat');

const City = require('../server/models/cities.model');
const Department = require('../server/models/departments.model');

if (!process.argv[2] || !process.argv[3]) {
  console.log('user and pass missing for UAPAY API');
  process.exit(0);
}

const http = axios.create({
  baseURL: 'https://api.escrowbox.uapay.ua/api',
  headers: {
    'Cache-Control': 'no-cache',
  },
  auth: {
    username: process.argv[2],
    password: process.argv[3],
  },
});

async function main() {
  console.log('loading cities');
  // find all the cities in which we haven't loaded the departments from
  const departments = await Department.find({}, { cityID: 1 });
  let currentCities = departments.map(depart => depart.cityID);
  console.log('current cities:', await City.countDocuments());
  currentCities = new Set(currentCities);
  console.log('current cities with departments:', currentCities.size);
  const citiesToLoad = await City.find({
    id: { $nin: Array.from(currentCities) },
  }); // .limit(10);
  console.log('citiesToLoad:', citiesToLoad.length);
  // await Department.collection.deleteMany({}, { safe: true });

  let i = 0;
  const promises = citiesToLoad
    // .filter((c, i) => i < 4)
    .map(
      throat(5, async city => {
        let departments;
        i++;
        try {
          // TODO: retry if error 500
          const res = await http.get(`/handlers/NovaPoshta/cities/${city.id}/offices`);
          if (!res.data || !res.data.data || !res.data.data.length) {
            if (!res.data || !res.data.data.length) console.log('no deparments for city id: %j (%j)', city.id, city.uk);
            if (!res.data || !res.data.data) console.error('error with city id: %j (%j)', city.id, city.uk);
            return Promise.resolve();
          }
          departments = res.data.data;
          const departmentsOnCity = await Department.findOne({ cityID: city.id });
          if (departmentsOnCity) return;
          console.log(`${i}/${citiesToLoad.length}`, city.uk);
        } catch (error) {
          console.error('error with city id: %j (%j)', city.id, city.uk);
          console.error(error);
          return Promise.resolve();
        }

        city.departmentsCount = departments.length;
        await city.save();
        // TODO: add department number to its own field for ease of sorting
        return await Department.insertMany(departments.map(o => ({ ...o, cityID: city.id })));
        // console.log(res[0]);
      })
    );
  await Promise.all(promises);
  console.log('done loading');

  const updatedDepartments = await Department.find({}, { cityID: 1 });
  let latestCities = updatedDepartments.map(depart => depart.cityID);
  latestCities = new Set(latestCities);
  console.log('latestCities:', latestCities.size);
  let citiesToDelete = await City.find({
    id: { $nin: Array.from(latestCities) },
  }); // .limit(10);
  citiesToDelete = citiesToDelete.map(c => c._id);

  // remove cities that do not have any Nova Poshta departments
  await City.deleteMany({ _id: { $in: citiesToDelete } });
  console.log('cities deleted:', citiesToDelete.length);
  process.exit(0);
}

const mongoURI = 'mongodb://localhost:27017/onova-data';

const options = {
  keepAlive: 1,
  useNewUrlParser: true,
};

mongoose.connect(mongoURI, options).then(
  () => {
    console.log(`connected to ${mongoURI}`);
    main();
  },
  err => {
    throw new Error(`unable to connect to: ${mongoURI} - ${err}`);
  }
);
