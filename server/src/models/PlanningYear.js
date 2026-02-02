import { DataTypes } from 'sequelize';

export default function (sequelize) {
  return sequelize.define(
    'PlanningYear',
    {
      planning_year_id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      year_label: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
      },
      status: {
        type: DataTypes.ENUM('DRAFT', 'ACTIVE', 'CLOSED'),
        allowNull: false,
      },
    },
    {
      tableName: 'planning_years',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false, // schema has only created_at
    }
  );
}
