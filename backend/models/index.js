const { Sequelize, DataTypes } = require("sequelize");
const dotenv = require("dotenv");

dotenv.config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  protocol: "postgres",
  dialectOptions: {
    ssl: process.env.NODE_ENV === "production" ? { require: true, rejectUnauthorized: false } : false,
  },
  logging: false,
});

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.User = require("./user")(sequelize, DataTypes);
db.Project = require("./project")(sequelize, DataTypes);
db.Task = require("./task")(sequelize, DataTypes);
db.Role = require("./role")(sequelize, DataTypes);

// Define relationships
db.User.belongsToMany(db.Project, { through: "UserProjects" });
db.Project.belongsToMany(db.User, { through: "UserProjects" });

db.Project.hasMany(db.Task);
db.Task.belongsTo(db.Project);

db.User.hasMany(db.Task);
db.Task.belongsTo(db.User);

module.exports = db;
