import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { BranchFormScreen } from '../../../../src/features/admin/branches/BranchFormScreen';

export default function EditBranchPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <BranchFormScreen branchId={id} />;
}
