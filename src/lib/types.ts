/**
 * Shared Type Definitions
 * 
 * This file contains the base types used across the application.
 * All other modules should import from here to avoid duplication.
 */

// ----- Base Expense Type -----

export interface BaseExpense {
    id: string;
    amount: number;
    category: string;
    subcategory?: string | null;
    date: string;
    note?: string | null;
    created_at?: string;
    updated_at?: number;
}

// ----- Base Subcategory Type -----

export interface BaseSubcategory {
    id: number;
    category: string;
    name: string;
}

// ----- Base Category Type -----

export interface BaseCategory {
    id: string;
    name: string;
    color: string;
}

// ----- Sync Status -----

export type SyncStatus = 'synced' | 'pending' | 'deleted';
