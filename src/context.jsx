import React, { useState, useEffect, useMemo, useRef, useCallback, useReducer, createContext, useContext, memo, Suspense, lazy, useId, useSyncExternalStore } from 'react';
import confetti from 'canvas-confetti';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);
import { CONFIG, MOTIVATIONAL_QUOTES, ACHIEVEMENT_DEFS, DAILY_CHALLENGE_POOL } from './config';
import { DateUtils, StatsUtils, HabitUtils } from './utils';
import { AnalyticsEngine, CognitiveEngine, ResearchEngine, AccountabilityEngine, PredictiveEngine, SkillTreeEngine } from './engines';
import { IconButton, ProgressRing, Badge, EmptyState, Skeleton, StatCard, HabitItem } from './components/ui';
import { FocusTimer, HabitModal, StudyTimer, AssignmentModal, TimetableModal, WellnessModal, JournalEntryModal, ExpenseModal, ResearchModal, SubjectManagerModal } from './components/modals';
import { WellnessAlertsCard, RoutinesSection, CycleTrackingCard, InsightsPanel, StatsOverview, HabitsList, RadarPanel, WeeklyAuditPanel, SkillTreePanel, NotificationPanel } from './components/panels';
import { SKILL_DOMAINS, MASTERY_LEVELS, createInitialState, appReducer, usePersistedState, useLoadState, useKeyboardShortcuts, useOnlineStatus, showToast, haptic, useApp, InsightCard, generateWellnessAlerts, MatrixView, AnalyticsView, SettingsView, DashboardPage, StudyView, JournalView, ExpenseView, CognitiveLoadBar, MetricCard, MiniHeatmap, GradeTrackerView, CalendarView, GoalView, rootElement, deferredPrompt } from './components/views';
import { AccountabilityConsole, CommandDashboard, App } from './components/app';

export const ActionTypes = Object.freeze({
    // Habit actions (existing)
    ADD_HABIT: 'ADD_HABIT',
    UPDATE_HABIT: 'UPDATE_HABIT',
    DELETE_HABIT: 'DELETE_HABIT',
    TOGGLE_HABIT: 'TOGGLE_HABIT',
    REORDER_HABITS: 'REORDER_HABITS',
    
    // Focus mode (enhanced)
    START_FOCUS: 'START_FOCUS',
    END_FOCUS: 'END_FOCUS',
    START_DEEP_WORK: 'START_DEEP_WORK',
    END_DEEP_WORK: 'END_DEEP_WORK',
    
    // Flashcards
    ADD_DECK: 'ADD_DECK',
    UPDATE_DECK: 'UPDATE_DECK',
    DELETE_DECK: 'DELETE_DECK',
    ADD_CARD: 'ADD_CARD',
    UPDATE_CARD: 'UPDATE_CARD',
    DELETE_CARD: 'DELETE_CARD',
    TOGGLE_SUSPEND_CARD: 'TOGGLE_SUSPEND_CARD',
    REVIEW_CARD: 'REVIEW_CARD',
    SET_ACTIVE_DECK: 'SET_ACTIVE_DECK',
    
    // Topics
    ADD_TOPIC: 'ADD_TOPIC',
    UPDATE_TOPIC: 'UPDATE_TOPIC',
    DELETE_TOPIC: 'DELETE_TOPIC',
    REORDER_TOPIC: 'REORDER_TOPIC',
    
    // Study Session Tracker
    START_STUDY_SESSION: 'START_STUDY_SESSION',
    END_STUDY_SESSION: 'END_STUDY_SESSION',
    DELETE_STUDY_SESSION: 'DELETE_STUDY_SESSION',
    UPDATE_STUDY_GOAL: 'UPDATE_STUDY_GOAL',
    
    // Assignments & Exams
    ADD_ASSIGNMENT: 'ADD_ASSIGNMENT',
    UPDATE_ASSIGNMENT: 'UPDATE_ASSIGNMENT',
    DELETE_ASSIGNMENT: 'DELETE_ASSIGNMENT',
    
    // Expenses
    ADD_EXPENSE: 'ADD_EXPENSE',
    UPDATE_EXPENSE: 'UPDATE_EXPENSE',
    DELETE_EXPENSE: 'DELETE_EXPENSE',
    SET_MONTHLY_BUDGET: 'SET_MONTHLY_BUDGET',
    
    // Wellness
    LOG_SLEEP: 'LOG_SLEEP',
    DELETE_SLEEP_LOG: 'DELETE_SLEEP_LOG',
    LOG_WATER: 'LOG_WATER',
    LOG_EXERCISE: 'LOG_EXERCISE',
    DELETE_EXERCISE: 'DELETE_EXERCISE',
    LOG_MOOD: 'LOG_MOOD',
    
    // Goals
    ADD_GOAL: 'ADD_GOAL',
    UPDATE_GOAL: 'UPDATE_GOAL',
    DELETE_GOAL: 'DELETE_GOAL',
    TOGGLE_MILESTONE: 'TOGGLE_MILESTONE',
    
    // Timetable
    ADD_TIMETABLE_ENTRY: 'ADD_TIMETABLE_ENTRY',
    UPDATE_TIMETABLE_ENTRY: 'UPDATE_TIMETABLE_ENTRY',
    DELETE_TIMETABLE_ENTRY: 'DELETE_TIMETABLE_ENTRY',
    
    // Journal
    ADD_JOURNAL_ENTRY: 'ADD_JOURNAL_ENTRY',
    UPDATE_JOURNAL_ENTRY: 'UPDATE_JOURNAL_ENTRY',
    DELETE_JOURNAL_ENTRY: 'DELETE_JOURNAL_ENTRY',
    
    // Research Intelligence Layer
    ADD_RESEARCH_ENTRY: 'ADD_RESEARCH_ENTRY',
    DELETE_RESEARCH_ENTRY: 'DELETE_RESEARCH_ENTRY',
    
    // Skill Trees
    ADD_SKILL_XP: 'ADD_SKILL_XP',
    ADD_RESEARCH_MILESTONE: 'ADD_RESEARCH_MILESTONE',
    
    // Gamification (Enhanced)
    USE_STREAK_FREEZE: 'USE_STREAK_FREEZE',
    ADD_POINTS: 'ADD_POINTS',
    ADD_XP: 'ADD_XP',
    EARN_ACHIEVEMENT: 'EARN_ACHIEVEMENT',
    GENERATE_DAILY_CHALLENGES: 'GENERATE_DAILY_CHALLENGES',
    COMPLETE_CHALLENGE: 'COMPLETE_CHALLENGE',
    
    // Subjects
    ADD_SUBJECT: 'ADD_SUBJECT',
    UPDATE_SUBJECT: 'UPDATE_SUBJECT',
    DELETE_SUBJECT: 'DELETE_SUBJECT',
    
    // Grades
    ADD_SEMESTER: 'ADD_SEMESTER',
    DELETE_SEMESTER: 'DELETE_SEMESTER',
    ADD_COURSE: 'ADD_COURSE',
    UPDATE_COURSE: 'UPDATE_COURSE',
    DELETE_COURSE: 'DELETE_COURSE',
    ADD_ASSESSMENT: 'ADD_ASSESSMENT',
    UPDATE_ASSESSMENT: 'UPDATE_ASSESSMENT',
    DELETE_ASSESSMENT: 'DELETE_ASSESSMENT',
    
    // Grading Schemes & Templates
    SET_ACTIVE_GRADING_SCHEME: 'SET_ACTIVE_GRADING_SCHEME',
    ADD_GRADING_SCHEME: 'ADD_GRADING_SCHEME',
    UPDATE_GRADING_SCHEME: 'UPDATE_GRADING_SCHEME',
    DELETE_GRADING_SCHEME: 'DELETE_GRADING_SCHEME',
    ADD_GRADE_TEMPLATE: 'ADD_GRADE_TEMPLATE',
    UPDATE_GRADE_TEMPLATE: 'UPDATE_GRADE_TEMPLATE',
    DELETE_GRADE_TEMPLATE: 'DELETE_GRADE_TEMPLATE',
    
    // Notifications
    ADD_NOTIFICATION: 'ADD_NOTIFICATION',
    MARK_NOTIFICATION_READ: 'MARK_NOTIFICATION_READ',
    CLEAR_NOTIFICATIONS: 'CLEAR_NOTIFICATIONS',
    
    // Wellness Insights
    DISMISS_INSIGHT_ALERT: 'DISMISS_INSIGHT_ALERT',
    UPDATE_WELLNESS_INSIGHT_SETTINGS: 'UPDATE_WELLNESS_INSIGHT_SETTINGS',
    
    // Routines
    ADD_ROUTINE: 'ADD_ROUTINE',
    UPDATE_ROUTINE: 'UPDATE_ROUTINE',
    DELETE_ROUTINE: 'DELETE_ROUTINE',
    COMPLETE_ROUTINE_TODAY: 'COMPLETE_ROUTINE_TODAY',
    
    // Cycle Tracking
    UPDATE_CYCLE_SETTINGS: 'UPDATE_CYCLE_SETTINGS',
    LOG_PERIOD: 'LOG_PERIOD',
    UPDATE_PERIOD: 'UPDATE_PERIOD',
    DELETE_PERIOD: 'DELETE_PERIOD',
    LOG_CYCLE_SYMPTOMS: 'LOG_CYCLE_SYMPTOMS',
    
    // UI
    SET_VIEW: 'SET_VIEW',
    SET_SELECTED_HABIT: 'SET_SELECTED_HABIT',
    SET_LOADING: 'SET_LOADING',
    
    // Settings
    UPDATE_SETTINGS: 'UPDATE_SETTINGS',
    
    // Undo/Redo
    UNDO: 'UNDO',
    REDO: 'REDO',
    
    // Persistence
    LOAD_STATE: 'LOAD_STATE',
    RESET_STATE: 'RESET_STATE'
});

/**
 * State reducer
 * @param {Object} state - Current state
 * @param {Object} action - Action to perform
 * @returns {Object} New state
 */
export const AppContext = createContext(null);

/**
 * Custom hook to access app context
 * @returns {{ state: Object, dispatch: Function }}
 */
