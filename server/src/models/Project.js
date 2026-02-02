import { DataTypes } from 'sequelize';

export default function (sequelize) {
  return sequelize.define(
    'Project',
    {
      project_id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      wbse_code: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
      },
      project_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'projects',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );
}
