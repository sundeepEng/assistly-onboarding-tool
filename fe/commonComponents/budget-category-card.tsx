"use client";

import React, { useState } from "react";
import { Progress } from "./progress";
import CommonModal from "./common-modal";
import PencilIcon from "../public/icons/pencil-icon";
import InputFormField from "./input-field-component";
import Button from "./button";
import { formatCurrency } from "../utils/budget-utils";



interface BudgetCategoryCardProps {
  title: string;
  categoryType: "income" | "expense";
  primaryValue: number; // Forecasted for income, Budgeted for expense
  actualValue: number; // Actual for both
  utilization: number | string; // Utilization percentage or "NA"
  className?: string;
  containerClassName?: string; // For customizing the main container styles
  onEdit?: (updatedData: {
    title: string;
    primaryValue: number;
    actualValue: number;
  }) => void; // Callback when data is edited and saved
}

export const BudgetCategoryCard: React.FC<BudgetCategoryCardProps> = ({
  title,
  categoryType,
  primaryValue,
  actualValue,
  utilization,
  className = "",
  containerClassName = "",
  onEdit,
}) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [editPrimaryValue, setEditPrimaryValue] = useState(primaryValue);
  const [editActualValue, setEditActualValue] = useState(actualValue);
  // Calculate remaining/over forecast based on category type
  const secondaryValue = categoryType === "income"
    ? primaryValue - actualValue // Over forecast
    : primaryValue - actualValue; // Remaining

  const getPrimaryLabel = () => {
    return categoryType === "income" ? "Forecasted" : "Budgeted";
  };

  const getSecondaryLabel = () => {
    return categoryType === "income" ? "Over Forecast" : "Remaining";
  };

  const getCategoryTypeStyles = () => {
    return categoryType === "income"
      ? "border-blue-200 bg-primary/10"
      : "border-gray-200 bg-gray-50";
  };

  const getCategoryTagStyles = () => {
    return categoryType === "income"
      ? "bg-white text-blue-800"
      : "bg-white text-red-800 ";
  };

  const handleEditClick = () => {
    setEditTitle(title);
    setEditPrimaryValue(primaryValue);
    setEditActualValue(actualValue);
    setIsEditModalOpen(true);
  };

  const handleSave = () => {
    if (onEdit) {
      onEdit({
        title: editTitle,
        primaryValue: editPrimaryValue,
        actualValue: editActualValue,
      });
    }
    setIsEditModalOpen(false);
  };

  const handleCancel = () => {
    setIsEditModalOpen(false);
  };

  return (
    <div className={`border rounded-lg p-4 ${getCategoryTypeStyles()} ${containerClassName} ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryTagStyles()}`}>
            {categoryType}
          </span>
          {onEdit && (
            <button
              onClick={handleEditClick}
              className="cursor-pointer bg-white rounded-full w-[40px] h-[40px]"
              title="Edit category"
            >
              <PencilIcon />
            </button>
          )}
        </div>
      </div>

      {/* Values */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">{getPrimaryLabel()}:</span>
          <span className="text-sm font-medium text-gray-900">
            {formatCurrency(primaryValue)}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Actual:</span>
          <span className="text-sm font-medium text-gray-900">
            {formatCurrency(actualValue)}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-sm text-gray-600">{getSecondaryLabel()}:</span>
          <span className={`text-sm font-medium ${secondaryValue >= 0 ? "text-green-600" : "text-red-600"
            }`}>
            {formatCurrency(Math.abs(secondaryValue))}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Utilization:</span>
          <span className="text-sm font-medium text-gray-900">{typeof utilization === 'number' ? `${utilization.toFixed(1)}%` : utilization}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-4">
        <Progress
          value={typeof utilization === 'number' ? Math.min(utilization, 100) : 0}
        // className={`h-2 ${getProgressColor()}`}
        />
      </div>

      {/* Edit Modal */}
      <CommonModal
        title={`Edit ${categoryType.charAt(0).toUpperCase() + categoryType.slice(1)} Category`}
        modalOpen={isEditModalOpen}
        setModalOpen={setIsEditModalOpen}
        width="400px"
        crossCTA={true}
      >
        <div className="w-full p-6 space-y-4">
          <div>
            <label className="font-medium mb-2 block">
              Category Title
            </label>
            <div className="font-medium">
              {title}
            </div>
          </div>



          <div>
            <label className="font-medium mb-2 block">
              Actual Amount
            </label>
            <div className="font-medium">
              ${actualValue.toLocaleString()}
            </div>
          </div>
          <InputFormField
            label={`${getPrimaryLabel()} Amount`}
            type="number"
            name="primaryValue"
            value={editPrimaryValue.toString()}
            onChange={(e) => setEditPrimaryValue(Number(e.target.value))}
          />


          <div className="flex justify-end gap-4 mt-8">
            <Button name="Cancel" classname="" buttonClick={handleCancel} />
            <Button name="Save" classname="" buttonClick={handleSave} />
          </div>
        </div>
      </CommonModal>
    </div>
  );
};

export default BudgetCategoryCard;
