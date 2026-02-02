import { Sequelize } from 'sequelize';
import { dbConfig } from '../config/database.js';
import projectModel from './Project.js';
import planningYearModel from './PlanningYear.js';
import projectMetadataModel from './ProjectMetadata.js';

const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    define: dbConfig.define,
    logging: dbConfig.logging,
  }
);

const Project = projectModel(sequelize);
const PlanningYear = planningYearModel(sequelize);
const ProjectMetadata = projectMetadataModel(sequelize);

// Associations
Project.hasMany(ProjectMetadata, { foreignKey: 'project_id' });
ProjectMetadata.belongsTo(Project, { foreignKey: 'project_id' });

PlanningYear.hasMany(ProjectMetadata, { foreignKey: 'planning_year_id' });
ProjectMetadata.belongsTo(PlanningYear, { foreignKey: 'planning_year_id' });

export { sequelize, Project, PlanningYear, ProjectMetadata };
