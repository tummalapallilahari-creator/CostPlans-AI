import { DataTypes } from 'sequelize';

export default function (sequelize) {
  return sequelize.define(
    'ProjectMetadata',
    {
      project_metadata_id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      project_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: { model: 'projects', key: 'project_id' },
      },
      planning_year_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: { model: 'planning_years', key: 'planning_year_id' },
      },
      division: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      branch: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      section_country: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      implementing_grant: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      trust_fund: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      earmarking: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      project_end_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
    },
    {
      tableName: 'project_metadata',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );
}
