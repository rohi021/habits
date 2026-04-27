import React, { useState, useEffect, useMemo, useRef, useCallback, useReducer, createContext, useContext, memo, Suspense, lazy, useId, useSyncExternalStore } from 'react';
import confetti from 'canvas-confetti';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);
import { CONFIG, MOTIVATIONAL_QUOTES, ACHIEVEMENT_DEFS, DAILY_CHALLENGE_POOL } from '../config';
import { DateUtils, StatsUtils, HabitUtils } from '../utils';
import { AnalyticsEngine, CognitiveEngine, ResearchEngine, AccountabilityEngine, PredictiveEngine, SkillTreeEngine } from '../engines';
import { ActionTypes, AppContext } from '../context';
import { IconButton, ProgressRing, Badge, EmptyState, Skeleton, StatCard, HabitItem } from './ui';
import { FocusTimer, HabitModal, StudyTimer, AssignmentModal, TimetableModal, WellnessModal, JournalEntryModal, ExpenseModal, ResearchModal, SubjectManagerModal } from './modals';
import { WellnessAlertsCard, RoutinesSection, CycleTrackingCard, InsightsPanel, StatsOverview, HabitsList, RadarPanel, WeeklyAuditPanel, SkillTreePanel, NotificationPanel } from './panels';
import { AccountabilityConsole, CommandDashboard, App } from './app';

export const SKILL_DOMAINS = Object.freeze({
    ml: { name: 'Machine Learning', icon: '🧠', color: 'purple' },
    robotics: { name: 'Robotics', icon: '🤖', color: 'cyan' },
    systems: { name: 'Systems', icon: '⚙️', color: 'amber' },
    leadership: { name: 'Leadership', icon: '🎯', color: 'emerald' },
    research: { name: 'Research', icon: '🔬', color: 'indigo' },
    engineering: { name: 'Engineering', icon: '🛠️', color: 'orange' }
});

export const MASTERY_LEVELS = Object.freeze([
    { level: 1, name: 'Novice', xpRequired: 0 },
    { level: 2, name: 'Apprentice', xpRequired: 100 },
    { level: 3, name: 'Practitioner', xpRequired: 300 },
    { level: 4, name: 'Specialist', xpRequired: 600 },
    { level: 5, name: 'Expert', xpRequired: 1000 },
    { level: 6, name: 'Master', xpRequired: 1500 },
    { level: 7, name: 'Grandmaster', xpRequired: 2500 }
]);

export const createInitialState = () => ({
    // Core data - Habits (existing)
    habits: {},
    habitOrder: [],
    
    // UI state
    view: 'dashboard',
    selectedHabit: null,
    isLoading: true,
    
    // Focus mode (enhanced - supports deep work)
    focusMode: {
        active: false,
        habitId: null,
        startTime: null,
        duration: 25 * 60, // 25 minutes default
        mode: 'off', // 'off' | 'deepWork' | 'studyOnly'
        endsAt: null,
        silenceNotifications: true,
        hideTabs: ['analytics', 'journal', 'expenses', 'settings']
    },
    
    // ===== NEW: Study Session Tracker =====
    studySessions: [], // { id, subject, startTime, endTime, duration, notes, date, type: 'regular'|'pomodoro' }
    studyGoal: { daily: 120, weekly: 600 }, // minutes
    subjects: [], // User-created subject list - SINGLE SOURCE OF TRUTH
    activeStudySession: null, // { subject, startTime, type, pomodoroCount, breakStartTime, topicId }
    
    // ===== Flashcards (Spaced Repetition) =====
    flashcards: {
        decks: [], // [{ id, subjectId, name, createdAt, settings: { newPerDay, reviewPerDay, learningStepsMins, easeFactorBase } }]
        cards: [], // [{ id, deckId, subjectId, front, back, tags, topicId, createdAt, updatedAt, suspended, state, dueAt, intervalDays, easeFactor, reps, lapses, lastReviewedAt }]
        reviews: [], // [{ id, cardId, deckId, subjectId, reviewedAt, grade, timeMs }]
        ui: { activeDeckId: null }
    },
    
    // ===== Topics (per-subject chapters/units) =====
    topics: [], // [{ id, subjectId, title, notes, order, plannedHours, progress, createdAt, updatedAt }]
    
    // ===== NEW: Assignments & Exams =====
    assignments: [], // { id, title, subject, dueDate, priority, status, grade, type: 'assignment'|'exam', prepProgress, topics, createdAt }
    
    // ===== NEW: Expenses =====
    expenses: [], // { id, amount, category, description, date }
    monthlyBudget: 5000,
    expenseCategories: ['Food', 'Transport', 'Books', 'Entertainment', 'Subscriptions', 'Health', 'Other'],
    
    // ===== NEW: Sleep & Wellness =====
    sleepLog: [], // { id, date, bedtime, wakeTime, hours, quality }
    waterLog: {}, // { [dateKey]: glasses }
    exerciseLog: [], // { id, date, type, duration, notes }
    moodLog: {}, // { [dateKey]: { mood, energy, note } }
    waterGoal: 8, // glasses per day
    sleepGoal: 8, // hours per night
    
    // ===== NEW: Goals with Milestones =====
    goals: [], // { id, title, description, category, targetDate, milestones: [{text, done}], createdAt }
    goalCategories: ['Academic', 'Health', 'Financial', 'Personal', 'Career'],
    
    // ===== NEW: Timetable =====
    timetable: [], // { id, subject, day, startTime, endTime, room, color, notes }
    
    // ===== NEW: Journal =====
    journalEntries: [], // { id, date, content, mood, energy, gratitude, tags, wordCount }
    
    // ===== Research Intelligence Layer =====
    researchLog: [], // { id, date, type: 'paper'|'experiment'|'model'|'deployment'|'insight'|'bugfix', title, notes, duration }
    
    // ===== Skill Trees =====
    skillXP: { ml: 0, robotics: 0, systems: 0, leadership: 0, research: 0, engineering: 0 },
    researchMilestones: [], // { id, title, domain, completedAt }
    
    // ===== Gamification (Enhanced) =====
    streakFreezes: 2,
    totalPoints: 0,
    xp: 0,
    level: 1,
    achievements: [], // earned achievement IDs
    dailyChallenges: [], // { id, text, type, target, progress, completed, date, xpReward }
    
    // ===== Grade Tracker =====
    grades: {
        semesters: [] // { id, name, courses: [{ id, name, creditHours, assessments: [{ id, name, type, componentWeight, weight, score, maxScore }] }] }
    },
    
    // ===== Grading Schemes & Templates =====
    grading: {
        activeSchemeId: 'default-india-10',
        schemes: [
            {
                id: 'default-india-10',
                name: 'India 10-point (default)',
                scaleMax: 10,
                rounding: { mode: 'fixed', decimals: 2 },
                boundaries: [
                    { minPercent: 90, gpa: 10, letter: 'O', label: 'Excellent' },
                    { minPercent: 80, gpa: 9,  letter: 'A+', label: 'Very Good' },
                    { minPercent: 70, gpa: 8,  letter: 'A',  label: 'Good' },
                    { minPercent: 60, gpa: 7,  letter: 'B+', label: 'Above Avg' },
                    { minPercent: 50, gpa: 6,  letter: 'B',  label: 'Avg' },
                    { minPercent: 40, gpa: 5,  letter: 'C',  label: 'Pass' },
                    { minPercent: 0,  gpa: 0,  letter: 'F',  label: 'Fail' }
                ]
            }
        ],
        templates: [
            {
                id: 'template-default',
                name: 'Default Components',
                components: [
                    { key: 'ct1', name: 'Class Test 1', type: 'Class Test', weight: 10 },
                    { key: 'ct2', name: 'Class Test 2', type: 'Class Test', weight: 10 },
                    { key: 'a1',  name: 'Assignment 1', type: 'Assignment', weight: 5 },
                    { key: 'a2',  name: 'Assignment 2', type: 'Assignment', weight: 5 },
                    { key: 'mid', name: 'Mid Semester', type: 'Mid Semester', weight: 30 },
                    { key: 'end', name: 'End Semester', type: 'End Semester', weight: 40 },
                    { key: 'att', name: 'Attendance',   type: 'Attendance', weight: 0 }
                ]
            }
        ]
    },
    
    // ===== Notifications =====
    notifications: [], // { id, type, title, message, read, createdAt, actionLink: { tab, subTab } }
    
    // Settings (Enhanced)
    settings: {
        theme: 'dark',
        soundEnabled: true,
        hapticEnabled: true,
        reminderTime: '21:00',
        weekStartsOn: 0, // 0 = Sunday
        currency: '₹',
        timeFormat: '12h',
        pomodoroStudy: 25,
        pomodoroShortBreak: 5,
        pomodoroLongBreak: 15,
        pomodoroCycles: 4,
        studyReminderEnabled: true,
        dailyStudyGoal: 120, // minutes
        weeklyStudyGoal: 600,
        monthlyBudget: 5000,
        waterGoal: 8,
        sleepGoal: 8,
        journalReminderEnabled: true
    },
    
    // Undo/Redo
    undoStack: [],
    redoStack: [],
    
    // Meta
    lastSyncedAt: null,
    _version: '3.0.0',
    _lastSaved: new Date().toISOString(),
    appVersion: '3.0.0',
    
    // ===== Wellness Insights =====
    wellnessInsights: {
        rulesEnabled: true,
        thresholds: {
            weeklySleepDebtHours: 5,
            burnoutRisingDelta: 0.12,
            studyLoadIncreasePct: 25,
            consecutiveLowMoodDays: 3
        },
        lastEvaluatedAt: null,
        dismissed: {}
    },
    
    // ===== Routines =====
    routines: {
        items: [],
        routineOrder: [],
        completions: {}
    },
    
    // ===== Cycle Tracking (optional) =====
    cycle: {
        enabled: false,
        settings: {
            averageCycleLength: 28,
            averagePeriodLength: 5,
            lutealLength: 14,
            remindersEnabled: false
        },
        periods: [],
        symptoms: {}
    }
});

/**
 * Action types enum
 */
export function appReducer(state, action) {
    const { type, payload } = action;
    
    // Helper to push to undo stack
    const withUndo = (newState) => ({
        ...newState,
        undoStack: [...state.undoStack.slice(-CONFIG.MAX_UNDO_STACK), {
            habits: state.habits,
            habitOrder: state.habitOrder
        }],
        redoStack: []
    });
    
    switch (type) {
        case ActionTypes.ADD_HABIT: {
            const id = crypto.randomUUID();
            const newHabit = {
                id,
                name: payload.name.trim(),
                color: payload.color || 'indigo',
                category: payload.category || 'General',
                quadrant: payload.quadrant || 'q2',
                archived: false,
                createdAt: new Date().toISOString(),
                data: {}
            };
            
            return withUndo({
                ...state,
                habits: { ...state.habits, [id]: newHabit },
                habitOrder: [...state.habitOrder, id]
            });
        }
        
        case ActionTypes.UPDATE_HABIT: {
            const { id, updates } = payload;
            if (!state.habits[id]) return state;
            
            return withUndo({
                ...state,
                habits: {
                    ...state.habits,
                    [id]: { ...state.habits[id], ...updates }
                }
            });
        }
        
        case ActionTypes.DELETE_HABIT: {
            const { id } = payload;
            const { [id]: deleted, ...remainingHabits } = state.habits;
            
            return withUndo({
                ...state,
                habits: remainingHabits,
                habitOrder: state.habitOrder.filter(hid => hid !== id)
            });
        }
        
        case ActionTypes.TOGGLE_HABIT: {
            const { id, date = DateUtils.toKey() } = payload;
            const habit = state.habits[id];
            if (!habit) return state;
            
            const wasCompleted = !!habit.data?.[date];
            const newData = { ...habit.data };
            
            if (wasCompleted) {
                delete newData[date];
            } else {
                newData[date] = true;
                
                // Celebration effect
                if (typeof confetti !== 'undefined') {
                    confetti({
                        particleCount: 50,
                        spread: 60,
                        origin: { y: 0.7 },
                        colors: [CONFIG.COLORS[habit.color]?.bg || '#6366f1', '#ffffff']
                    });
                }
            }
            
            return withUndo({
                ...state,
                habits: {
                    ...state.habits,
                    [id]: { ...habit, data: newData }
                },
                totalPoints: state.totalPoints + (wasCompleted ? -10 : 10)
            });
        }
        
        case ActionTypes.REORDER_HABITS: {
            return withUndo({
                ...state,
                habitOrder: payload.order
            });
        }
        
        case ActionTypes.START_FOCUS: {
            return {
                ...state,
                focusMode: {
                    ...state.focusMode,
                    active: true,
                    habitId: payload.habitId,
                    startTime: Date.now(),
                    duration: payload.duration || 25 * 60
                }
            };
        }
        
        case ActionTypes.END_FOCUS: {
            return {
                ...state,
                focusMode: {
                    ...state.focusMode,
                    active: false,
                    habitId: null,
                    startTime: null,
                    duration: 25 * 60,
                    mode: 'off',
                    endsAt: null
                }
            };
        }
        
        case ActionTypes.START_DEEP_WORK: {
            const durationMs = (payload.durationMinutes || 50) * 60 * 1000;
            return {
                ...state,
                focusMode: {
                    ...state.focusMode,
                    active: true,
                    mode: payload.mode || 'deepWork',
                    startTime: Date.now(),
                    endsAt: new Date(Date.now() + durationMs).toISOString(),
                    duration: (payload.durationMinutes || 50) * 60,
                    silenceNotifications: true,
                    hideTabs: payload.mode === 'studyOnly' ? ['analytics', 'journal', 'expenses', 'settings'] : ['analytics', 'journal', 'expenses', 'settings', 'matrix', 'command']
                }
            };
        }
        
        case ActionTypes.END_DEEP_WORK: {
            return {
                ...state,
                focusMode: {
                    active: false,
                    habitId: null,
                    startTime: null,
                    duration: 25 * 60,
                    mode: 'off',
                    endsAt: null,
                    silenceNotifications: true,
                    hideTabs: ['analytics', 'journal', 'expenses', 'settings']
                }
            };
        }
        
        // ===== FLASHCARDS =====
        case ActionTypes.ADD_DECK: {
            return { ...state, flashcards: { ...state.flashcards, decks: [...(state.flashcards?.decks || []), payload] } };
        }
        case ActionTypes.UPDATE_DECK: {
            return { ...state, flashcards: { ...state.flashcards, decks: (state.flashcards?.decks || []).map(d => d.id === payload.id ? { ...d, ...payload } : d) } };
        }
        case ActionTypes.DELETE_DECK: {
            return { ...state, flashcards: { ...state.flashcards, decks: (state.flashcards?.decks || []).filter(d => d.id !== payload), cards: (state.flashcards?.cards || []).filter(c => c.deckId !== payload), reviews: (state.flashcards?.reviews || []).filter(r => r.deckId !== payload) } };
        }
        case ActionTypes.ADD_CARD: {
            return { ...state, flashcards: { ...state.flashcards, cards: [...(state.flashcards?.cards || []), payload] } };
        }
        case ActionTypes.UPDATE_CARD: {
            return { ...state, flashcards: { ...state.flashcards, cards: (state.flashcards?.cards || []).map(c => c.id === payload.id ? { ...c, ...payload } : c) } };
        }
        case ActionTypes.DELETE_CARD: {
            return { ...state, flashcards: { ...state.flashcards, cards: (state.flashcards?.cards || []).filter(c => c.id !== payload) } };
        }
        case ActionTypes.TOGGLE_SUSPEND_CARD: {
            return { ...state, flashcards: { ...state.flashcards, cards: (state.flashcards?.cards || []).map(c => c.id === payload ? { ...c, suspended: !c.suspended } : c) } };
        }
        case ActionTypes.REVIEW_CARD: {
            // payload: { cardId, grade (0-3), timeMs }
            const { cardId, grade, timeMs } = payload;
            const cards = state.flashcards?.cards || [];
            const card = cards.find(c => c.id === cardId);
            if (!card) return state;
            
            const now = new Date();
            const deck = (state.flashcards?.decks || []).find(d => d.id === card.deckId);
            const learningSteps = deck?.settings?.learningStepsMins || [10, 1440]; // minutes
            let newCard = { ...card };
            
            if (card.state === 'new') {
                newCard.state = 'learning';
                newCard.reps = 0;
                newCard.dueAt = new Date(now.getTime() + learningSteps[0] * 60000).toISOString();
            } else if (card.state === 'learning') {
                if (grade <= 0) {
                    newCard.dueAt = new Date(now.getTime() + learningSteps[0] * 60000).toISOString();
                    newCard.lapses = (newCard.lapses || 0) + 1;
                } else {
                    const currentStep = learningSteps.findIndex(s => {
                        const stepDue = new Date(now.getTime() + s * 60000);
                        return card.dueAt && new Date(card.dueAt) <= stepDue;
                    });
                    const nextStep = Math.min((currentStep >= 0 ? currentStep : 0) + 1, learningSteps.length);
                    if (nextStep >= learningSteps.length || grade >= 3) {
                        newCard.state = 'review';
                        newCard.intervalDays = grade >= 3 ? 4 : 1;
                        newCard.dueAt = new Date(now.getTime() + newCard.intervalDays * 86400000).toISOString();
                    } else {
                        newCard.dueAt = new Date(now.getTime() + learningSteps[nextStep] * 60000).toISOString();
                    }
                }
            } else {
                // review state - SM-2 algorithm
                let ef = newCard.easeFactor || 2.5;
                let iv = newCard.intervalDays || 1;
                if (grade === 0) { ef = Math.max(1.3, ef - 0.2); iv = 1; newCard.lapses = (newCard.lapses || 0) + 1; }
                else if (grade === 1) { ef = Math.max(1.3, ef - 0.15); iv = Math.max(1, Math.round(iv * 1.2)); }
                else if (grade === 2) { iv = Math.max(1, Math.round(iv * ef)); }
                else { ef = ef + 0.15; iv = Math.max(1, Math.round(iv * ef * 1.3)); }
                newCard.easeFactor = ef;
                newCard.intervalDays = iv;
                newCard.dueAt = new Date(now.getTime() + iv * 86400000).toISOString();
            }
            
            newCard.reps = (newCard.reps || 0) + 1;
            newCard.lastReviewedAt = now.toISOString();
            newCard.updatedAt = now.toISOString();
            
            const review = {
                id: crypto.randomUUID(),
                cardId,
                deckId: card.deckId,
                subjectId: card.subjectId,
                reviewedAt: now.toISOString(),
                grade,
                timeMs: timeMs || 0
            };
            
            // XP: +1 per review, capped at 50/day
            const todayKey = DateUtils.toKey();
            const todayReviews = (state.flashcards?.reviews || []).filter(r => r.reviewedAt?.startsWith(todayKey)).length;
            const xpGain = todayReviews < 50 ? 1 : 0;
            
            return {
                ...state,
                flashcards: {
                    ...state.flashcards,
                    cards: cards.map(c => c.id === cardId ? newCard : c),
                    reviews: [...(state.flashcards?.reviews || []), review]
                },
                xp: (state.xp || 0) + xpGain
            };
        }
        case ActionTypes.SET_ACTIVE_DECK: {
            return { ...state, flashcards: { ...state.flashcards, ui: { ...(state.flashcards?.ui || {}), activeDeckId: payload } } };
        }
        
        // ===== TOPICS =====
        case ActionTypes.ADD_TOPIC: {
            return { ...state, topics: [...(state.topics || []), payload] };
        }
        case ActionTypes.UPDATE_TOPIC: {
            return { ...state, topics: (state.topics || []).map(t => t.id === payload.id ? { ...t, ...payload } : t) };
        }
        case ActionTypes.DELETE_TOPIC: {
            return { ...state, topics: (state.topics || []).filter(t => t.id !== payload) };
        }
        case ActionTypes.REORDER_TOPIC: {
            const { topicId: rtId, direction } = payload;
            const topicsList = [...(state.topics || [])];
            const idx = topicsList.findIndex(t => t.id === rtId);
            if (idx < 0) return state;
            const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
            if (swapIdx < 0 || swapIdx >= topicsList.length) return state;
            [topicsList[idx], topicsList[swapIdx]] = [topicsList[swapIdx], topicsList[idx]];
            return { ...state, topics: topicsList.map((t, i) => ({ ...t, order: i })) };
        }
        
        case ActionTypes.USE_STREAK_FREEZE: {
            if (state.streakFreezes <= 0) return state;
            return { ...state, streakFreezes: state.streakFreezes - 1 };
        }
        
        case ActionTypes.SET_VIEW: {
            return { ...state, view: payload };
        }
        
        case ActionTypes.SET_LOADING: {
            return { ...state, isLoading: payload };
        }
        
        case ActionTypes.UPDATE_SETTINGS: {
            return {
                ...state,
                settings: { ...state.settings, ...payload }
            };
        }
        
        case ActionTypes.UNDO: {
            if (state.undoStack.length === 0) return state;
            const previous = state.undoStack[state.undoStack.length - 1];
            
            return {
                ...state,
                habits: previous.habits,
                habitOrder: previous.habitOrder,
                undoStack: state.undoStack.slice(0, -1),
                redoStack: [{
                    habits: state.habits,
                    habitOrder: state.habitOrder
                }, ...state.redoStack]
            };
        }
        
        case ActionTypes.REDO: {
            if (state.redoStack.length === 0) return state;
            const next = state.redoStack[0];
            
            return {
                ...state,
                habits: next.habits,
                habitOrder: next.habitOrder,
                undoStack: [...state.undoStack, {
                    habits: state.habits,
                    habitOrder: state.habitOrder
                }],
                redoStack: state.redoStack.slice(1)
            };
        }
        
        // ===== STUDY SESSION ACTIONS =====
        case ActionTypes.START_STUDY_SESSION: {
            const { subject, type = 'regular' } = payload;
            return {
                ...state,
                activeStudySession: {
                    subject,
                    startTime: Date.now(),
                    type,
                    pomodoroCount: 0,
                    breakStartTime: null
                }
            };
        }
        
        case ActionTypes.END_STUDY_SESSION: {
            if (!state.activeStudySession) return state;
            
            const session = {
                id: crypto.randomUUID(),
                subject: state.activeStudySession.subject,
                startTime: state.activeStudySession.startTime,
                endTime: Date.now(),
                duration: Math.floor((Date.now() - state.activeStudySession.startTime) / 1000 / 60), // minutes
                notes: payload?.notes || '',
                date: DateUtils.toKey(),
                type: state.activeStudySession.type,
                pomodoroCount: state.activeStudySession.pomodoroCount || 0,
                topicId: state.activeStudySession.topicId || null
            };
            
            const xpEarned = Math.floor(session.duration / 5) * 2; // 2 XP per 5 minutes
            
            return {
                ...state,
                studySessions: [...state.studySessions, session],
                activeStudySession: null,
                xp: state.xp + xpEarned
            };
        }
        
        case ActionTypes.DELETE_STUDY_SESSION: {
            return {
                ...state,
                studySessions: state.studySessions.filter(s => s.id !== payload.id)
            };
        }
        
        case ActionTypes.UPDATE_STUDY_GOAL: {
            return {
                ...state,
                studyGoal: { ...state.studyGoal, ...payload }
            };
        }
        
        // ===== ASSIGNMENT ACTIONS =====
        case ActionTypes.ADD_ASSIGNMENT: {
            const assignment = {
                id: crypto.randomUUID(),
                ...payload,
                createdAt: new Date().toISOString()
            };
            return {
                ...state,
                assignments: [...state.assignments, assignment],
                xp: state.xp + 5 // XP for planning
            };
        }
        
        case ActionTypes.UPDATE_ASSIGNMENT: {
            const { id, updates } = payload;
            const updatedAssignments = state.assignments.map(a =>
                a.id === id ? { ...a, ...updates } : a
            );
            
            // Award XP for completing assignment
            const assignment = state.assignments.find(a => a.id === id);
            let xpGain = 0;
            if (assignment && updates.status === 'completed' && assignment.status !== 'completed') {
                xpGain = assignment.type === 'exam' ? 50 : 30;
            }
            
            return {
                ...state,
                assignments: updatedAssignments,
                xp: state.xp + xpGain
            };
        }
        
        case ActionTypes.DELETE_ASSIGNMENT: {
            return {
                ...state,
                assignments: state.assignments.filter(a => a.id !== payload.id)
            };
        }
        
        // ===== EXPENSE ACTIONS =====
        case ActionTypes.ADD_EXPENSE: {
            const expense = {
                id: crypto.randomUUID(),
                ...payload,
                date: payload.date || DateUtils.toKey()
            };
            return {
                ...state,
                expenses: [...state.expenses, expense],
                xp: state.xp + 2 // XP for tracking
            };
        }
        
        case ActionTypes.UPDATE_EXPENSE: {
            const { id, updates } = payload;
            return {
                ...state,
                expenses: state.expenses.map(e => e.id === id ? { ...e, ...updates } : e)
            };
        }
        
        case ActionTypes.DELETE_EXPENSE: {
            return {
                ...state,
                expenses: state.expenses.filter(e => e.id !== payload.id)
            };
        }
        
        case ActionTypes.SET_MONTHLY_BUDGET: {
            return {
                ...state,
                monthlyBudget: payload.budget,
                settings: { ...state.settings, monthlyBudget: payload.budget }
            };
        }
        
        // ===== WELLNESS ACTIONS =====
        case ActionTypes.LOG_SLEEP: {
            const sleepEntry = {
                id: crypto.randomUUID(),
                date: payload.date || DateUtils.toKey(),
                bedtime: payload.bedtime,
                wakeTime: payload.wakeTime,
                hours: payload.hours,
                quality: payload.quality
            };
            return {
                ...state,
                sleepLog: [...state.sleepLog, sleepEntry],
                xp: state.xp + 5
            };
        }
        
        case ActionTypes.DELETE_SLEEP_LOG: {
            return {
                ...state,
                sleepLog: state.sleepLog.filter(s => s.id !== payload.id)
            };
        }
        
        case ActionTypes.LOG_WATER: {
            const { date = DateUtils.toKey(), glasses } = payload;
            return {
                ...state,
                waterLog: { ...state.waterLog, [date]: glasses },
                xp: state.xp + 1
            };
        }
        
        case ActionTypes.LOG_EXERCISE: {
            const exercise = {
                id: crypto.randomUUID(),
                date: payload.date || DateUtils.toKey(),
                type: payload.type,
                duration: payload.duration,
                notes: payload.notes || ''
            };
            return {
                ...state,
                exerciseLog: [...state.exerciseLog, exercise],
                xp: state.xp + 10
            };
        }
        
        case ActionTypes.DELETE_EXERCISE: {
            return {
                ...state,
                exerciseLog: state.exerciseLog.filter(e => e.id !== payload.id)
            };
        }
        
        case ActionTypes.LOG_MOOD: {
            const { date = DateUtils.toKey(), mood, energy, note } = payload;
            return {
                ...state,
                moodLog: { ...state.moodLog, [date]: { mood, energy, note } },
                xp: state.xp + 3
            };
        }
        
        // ===== GOAL ACTIONS =====
        case ActionTypes.ADD_GOAL: {
            const goal = {
                id: crypto.randomUUID(),
                ...payload,
                milestones: payload.milestones || [],
                createdAt: new Date().toISOString()
            };
            return {
                ...state,
                goals: [...state.goals, goal],
                xp: state.xp + 15
            };
        }
        
        case ActionTypes.UPDATE_GOAL: {
            const { id, updates } = payload;
            return {
                ...state,
                goals: state.goals.map(g => g.id === id ? { ...g, ...updates } : g)
            };
        }
        
        case ActionTypes.DELETE_GOAL: {
            return {
                ...state,
                goals: state.goals.filter(g => g.id !== payload.id)
            };
        }
        
        case ActionTypes.TOGGLE_MILESTONE: {
            const { goalId, milestoneIndex } = payload;
            const updatedGoals = state.goals.map(goal => {
                if (goal.id === goalId) {
                    const newMilestones = [...goal.milestones];
                    newMilestones[milestoneIndex] = {
                        ...newMilestones[milestoneIndex],
                        done: !newMilestones[milestoneIndex].done
                    };
                    return { ...goal, milestones: newMilestones };
                }
                return goal;
            });
            return {
                ...state,
                goals: updatedGoals,
                xp: state.xp + 5
            };
        }
        
        // ===== TIMETABLE ACTIONS =====
        case ActionTypes.ADD_TIMETABLE_ENTRY: {
            const entry = {
                id: crypto.randomUUID(),
                ...payload
            };
            return {
                ...state,
                timetable: [...state.timetable, entry],
                xp: state.xp + 5
            };
        }
        
        case ActionTypes.UPDATE_TIMETABLE_ENTRY: {
            const { id, updates } = payload;
            return {
                ...state,
                timetable: state.timetable.map(t => t.id === id ? { ...t, ...updates } : t)
            };
        }
        
        case ActionTypes.DELETE_TIMETABLE_ENTRY: {
            return {
                ...state,
                timetable: state.timetable.filter(t => t.id !== payload.id)
            };
        }
        
        // ===== JOURNAL ACTIONS =====
        case ActionTypes.ADD_JOURNAL_ENTRY: {
            const entry = {
                id: crypto.randomUUID(),
                date: payload.date || DateUtils.toKey(),
                content: payload.content,
                mood: payload.mood,
                energy: payload.energy,
                gratitude: payload.gratitude || '',
                tags: payload.tags || [],
                wordCount: payload.content.trim().split(/\s+/).length
            };
            return {
                ...state,
                journalEntries: [...state.journalEntries, entry],
                xp: state.xp + 10
            };
        }
        
        case ActionTypes.UPDATE_JOURNAL_ENTRY: {
            const { id, updates } = payload;
            return {
                ...state,
                journalEntries: state.journalEntries.map(e =>
                    e.id === id ? { ...e, ...updates } : e
                )
            };
        }
        
        case ActionTypes.DELETE_JOURNAL_ENTRY: {
            return {
                ...state,
                journalEntries: state.journalEntries.filter(e => e.id !== payload.id)
            };
        }
        
        // ===== RESEARCH INTELLIGENCE ACTIONS =====
        case ActionTypes.ADD_RESEARCH_ENTRY: {
            const entry = {
                id: crypto.randomUUID(),
                date: payload.date || DateUtils.toKey(),
                type: payload.type, // paper, experiment, model, deployment, insight, bugfix
                title: payload.title,
                notes: payload.notes || '',
                duration: payload.duration || 0, // minutes
                domain: payload.domain || 'research' // skill domain
            };
            // XP rewards per research activity type (balances effort vs impact):
            // Paper reading (15), Experiment (25), Model training (35), Deployment (50), Insight (10), Bugfix (8)
            const RESEARCH_XP_REWARDS = { paper: 15, experiment: 25, model: 35, deployment: 50, insight: 10, bugfix: 8 };
            const xpGain = RESEARCH_XP_REWARDS[entry.type] || 10;
            const updatedSkillXP = { ...(state.skillXP || {}) };
            updatedSkillXP[entry.domain] = (updatedSkillXP[entry.domain] || 0) + xpGain;
            
            return {
                ...state,
                researchLog: [...(state.researchLog || []), entry],
                skillXP: updatedSkillXP,
                xp: state.xp + xpGain
            };
        }
        
        case ActionTypes.DELETE_RESEARCH_ENTRY: {
            return {
                ...state,
                researchLog: (state.researchLog || []).filter(r => r.id !== payload.id)
            };
        }
        
        case ActionTypes.ADD_SKILL_XP: {
            const { domain, amount } = payload;
            const updatedSkillXP = { ...(state.skillXP || {}) };
            updatedSkillXP[domain] = (updatedSkillXP[domain] || 0) + amount;
            return {
                ...state,
                skillXP: updatedSkillXP,
                xp: state.xp + amount
            };
        }
        
        case ActionTypes.ADD_RESEARCH_MILESTONE: {
            const milestone = {
                id: crypto.randomUUID(),
                title: payload.title,
                domain: payload.domain,
                completedAt: new Date().toISOString()
            };
            return {
                ...state,
                researchMilestones: [...(state.researchMilestones || []), milestone],
                xp: state.xp + 100
            };
        }
        
        // ===== GAMIFICATION ACTIONS =====
        case ActionTypes.ADD_XP: {
            const newXP = state.xp + payload.amount;
            const newLevel = Math.floor(Math.sqrt(newXP / 100)) + 1; // Level formula
            return {
                ...state,
                xp: newXP,
                level: Math.min(newLevel, 50) // Cap at level 50
            };
        }
        
        case ActionTypes.EARN_ACHIEVEMENT: {
            if (state.achievements.includes(payload.id)) return state;
            return {
                ...state,
                achievements: [...state.achievements, payload.id],
                xp: state.xp + (payload.xpReward || 50)
            };
        }
        
        case ActionTypes.GENERATE_DAILY_CHALLENGES: {
            // Clear old challenges if new day
            const today = DateUtils.toKey();
            const existingChallenges = state.dailyChallenges.filter(c => c.date === today);
            
            if (existingChallenges.length > 0) return state;
            
            // Deterministic selection based on day-of-year
            const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
            const poolSize = DAILY_CHALLENGE_POOL.length;
            const selected = [];
            for (let i = 0; i < 3; i++) {
                const idx = (dayOfYear * 7 + i * 13) % poolSize;
                const challenge = DAILY_CHALLENGE_POOL[idx];
                selected.push({
                    id: crypto.randomUUID(),
                    text: challenge.text,
                    type: challenge.type,
                    target: challenge.target,
                    progress: 0,
                    completed: false,
                    date: today,
                    xpReward: challenge.xp
                });
            }
            
            return {
                ...state,
                dailyChallenges: selected
            };
        }
        
        case ActionTypes.COMPLETE_CHALLENGE: {
            const { id } = payload;
            const challenge = state.dailyChallenges.find(c => c.id === id);
            if (!challenge || challenge.completed) return state;
            
            const updatedChallenges = state.dailyChallenges.map(c =>
                c.id === id ? { ...c, completed: true } : c
            );
            
            return {
                ...state,
                dailyChallenges: updatedChallenges,
                xp: state.xp + challenge.xpReward
            };
        }
        
        // ===== SUBJECT MANAGEMENT =====
        case ActionTypes.ADD_SUBJECT: {
            return {
                ...state,
                subjects: [...state.subjects, payload]
            };
        }
        
        case ActionTypes.UPDATE_SUBJECT: {
            return {
                ...state,
                subjects: state.subjects.map(s => s.id === payload.id ? { ...s, ...payload } : s)
            };
        }
        
        case ActionTypes.DELETE_SUBJECT: {
            return {
                ...state,
                subjects: state.subjects.filter(s => s.id !== payload.id)
            };
        }
        
        // ===== GRADE TRACKER =====
        case ActionTypes.ADD_SEMESTER: {
            return {
                ...state,
                grades: {
                    ...state.grades,
                    semesters: [...(state.grades?.semesters || []), payload]
                }
            };
        }
        
        case ActionTypes.DELETE_SEMESTER: {
            return {
                ...state,
                grades: {
                    ...state.grades,
                    semesters: (state.grades?.semesters || []).filter(sem => sem.id !== payload)
                }
            };
        }
        
        case ActionTypes.ADD_COURSE: {
            const { semesterId, course } = payload;
            return {
                ...state,
                grades: {
                    ...state.grades,
                    semesters: (state.grades?.semesters || []).map(sem =>
                        sem.id === semesterId
                            ? { ...sem, courses: [...(sem.courses || []), course] }
                            : sem
                    )
                }
            };
        }
        
        case ActionTypes.UPDATE_COURSE: {
            const { semesterId: uSemId, courseId: uCourseId, updates: courseUpdates } = payload;
            return {
                ...state,
                grades: {
                    ...state.grades,
                    semesters: (state.grades?.semesters || []).map(sem =>
                        sem.id === uSemId
                            ? {
                                ...sem,
                                courses: (sem.courses || []).map(c =>
                                    c.id === uCourseId ? { ...c, ...courseUpdates } : c
                                )
                            }
                            : sem
                    )
                }
            };
        }
        
        case ActionTypes.DELETE_COURSE: {
            const { semesterId: dcSemId, courseId: dcCourseId } = payload;
            return {
                ...state,
                grades: {
                    ...state.grades,
                    semesters: (state.grades?.semesters || []).map(sem =>
                        sem.id === dcSemId
                            ? { ...sem, courses: (sem.courses || []).filter(c => c.id !== dcCourseId) }
                            : sem
                    )
                }
            };
        }
        
        case ActionTypes.ADD_ASSESSMENT: {
            const { semesterId: semId, courseId, assessment } = payload;
            return {
                ...state,
                grades: {
                    ...state.grades,
                    semesters: (state.grades?.semesters || []).map(sem =>
                        sem.id === semId
                            ? {
                                ...sem,
                                courses: (sem.courses || []).map(c =>
                                    c.id === courseId
                                        ? { ...c, assessments: [...(c.assessments || []), assessment] }
                                        : c
                                )
                            }
                            : sem
                    )
                }
            };
        }
        
        case ActionTypes.UPDATE_ASSESSMENT: {
            const { semesterId: uaSemId, courseId: uaCourseId, assessmentId: uaAssId, updates: aUpdates } = payload;
            return {
                ...state,
                grades: {
                    ...state.grades,
                    semesters: (state.grades?.semesters || []).map(sem =>
                        sem.id === uaSemId
                            ? {
                                ...sem,
                                courses: (sem.courses || []).map(c =>
                                    c.id === uaCourseId
                                        ? { ...c, assessments: (c.assessments || []).map(a => a.id === uaAssId ? { ...a, ...aUpdates } : a) }
                                        : c
                                )
                            }
                            : sem
                    )
                }
            };
        }
        
        case ActionTypes.DELETE_ASSESSMENT: {
            const { semesterId: dSemId, courseId: dCourseId, assessmentId } = payload;
            return {
                ...state,
                grades: {
                    ...state.grades,
                    semesters: (state.grades?.semesters || []).map(sem =>
                        sem.id === dSemId
                            ? {
                                ...sem,
                                courses: (sem.courses || []).map(c =>
                                    c.id === dCourseId
                                        ? { ...c, assessments: (c.assessments || []).filter(a => a.id !== assessmentId) }
                                        : c
                                )
                            }
                            : sem
                    )
                }
            };
        }
        
        // ===== GRADING SCHEMES & TEMPLATES =====
        case ActionTypes.SET_ACTIVE_GRADING_SCHEME: {
            return { ...state, grading: { ...state.grading, activeSchemeId: payload } };
        }
        case ActionTypes.ADD_GRADING_SCHEME: {
            return { ...state, grading: { ...state.grading, schemes: [...(state.grading?.schemes || []), payload] } };
        }
        case ActionTypes.UPDATE_GRADING_SCHEME: {
            return { ...state, grading: { ...state.grading, schemes: (state.grading?.schemes || []).map(s => s.id === payload.id ? { ...s, ...payload } : s) } };
        }
        case ActionTypes.DELETE_GRADING_SCHEME: {
            return { ...state, grading: { ...state.grading, schemes: (state.grading?.schemes || []).filter(s => s.id !== payload) } };
        }
        case ActionTypes.ADD_GRADE_TEMPLATE: {
            return { ...state, grading: { ...state.grading, templates: [...(state.grading?.templates || []), payload] } };
        }
        case ActionTypes.UPDATE_GRADE_TEMPLATE: {
            return { ...state, grading: { ...state.grading, templates: (state.grading?.templates || []).map(t => t.id === payload.id ? { ...t, ...payload } : t) } };
        }
        case ActionTypes.DELETE_GRADE_TEMPLATE: {
            return { ...state, grading: { ...state.grading, templates: (state.grading?.templates || []).filter(t => t.id !== payload) } };
        }
        
        // ===== NOTIFICATIONS =====
        case ActionTypes.ADD_NOTIFICATION: {
            return {
                ...state,
                notifications: [payload, ...(state.notifications || [])].slice(0, 50)
            };
        }
        
        case ActionTypes.MARK_NOTIFICATION_READ: {
            return {
                ...state,
                notifications: (state.notifications || []).map(n =>
                    n.id === payload.id ? { ...n, read: true } : n
                )
            };
        }
        
        case ActionTypes.CLEAR_NOTIFICATIONS: {
            return {
                ...state,
                notifications: []
            };
        }
        
        // ===== Wellness Insights =====
        case ActionTypes.DISMISS_INSIGHT_ALERT: {
            return {
                ...state,
                wellnessInsights: {
                    ...state.wellnessInsights,
                    dismissed: {
                        ...(state.wellnessInsights?.dismissed || {}),
                        [payload.alertId]: new Date().toISOString()
                    }
                }
            };
        }
        
        case ActionTypes.UPDATE_WELLNESS_INSIGHT_SETTINGS: {
            return {
                ...state,
                wellnessInsights: {
                    ...state.wellnessInsights,
                    ...payload
                }
            };
        }
        
        // ===== Routines =====
        case ActionTypes.ADD_ROUTINE: {
            const newRoutine = {
                id: `routine-${Date.now()}`,
                name: payload.name || 'New Routine',
                icon: payload.icon || '☀️',
                habitIds: payload.habitIds || [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            return {
                ...state,
                routines: {
                    ...state.routines,
                    items: [...(state.routines?.items || []), newRoutine],
                    routineOrder: [...(state.routines?.routineOrder || []), newRoutine.id]
                }
            };
        }
        
        case ActionTypes.UPDATE_ROUTINE: {
            return {
                ...state,
                routines: {
                    ...state.routines,
                    items: (state.routines?.items || []).map(r =>
                        r.id === payload.id ? { ...r, ...payload, updatedAt: new Date().toISOString() } : r
                    )
                }
            };
        }
        
        case ActionTypes.DELETE_ROUTINE: {
            return {
                ...state,
                routines: {
                    ...state.routines,
                    items: (state.routines?.items || []).filter(r => r.id !== payload.id),
                    routineOrder: (state.routines?.routineOrder || []).filter(id => id !== payload.id)
                }
            };
        }
        
        case ActionTypes.COMPLETE_ROUTINE_TODAY: {
            const todayKey = DateUtils.toKey();
            const routine = (state.routines?.items || []).find(r => r.id === payload.routineId);
            if (!routine) return state;
            
            // Mark all habits in routine as completed for today (atomically)
            const newHabits = { ...state.habits };
            const completedIds = [];
            let xpGain = 0;
            
            routine.habitIds.forEach(hid => {
                const habit = newHabits[hid];
                if (habit && !habit.data?.[todayKey]) {
                    newHabits[hid] = {
                        ...habit,
                        data: { ...habit.data, [todayKey]: true }
                    };
                    completedIds.push(hid);
                    xpGain += 10;
                }
            });
            
            const todayCompletions = state.routines?.completions?.[todayKey] || {};
            const existingCompletion = todayCompletions[payload.routineId];
            
            return withUndo({
                ...state,
                habits: newHabits,
                totalPoints: state.totalPoints + xpGain,
                routines: {
                    ...state.routines,
                    completions: {
                        ...(state.routines?.completions || {}),
                        [todayKey]: {
                            ...todayCompletions,
                            [payload.routineId]: {
                                completedAt: new Date().toISOString(),
                                habitIdsCompleted: [...new Set([
                                    ...(existingCompletion?.habitIdsCompleted || []),
                                    ...completedIds
                                ])]
                            }
                        }
                    }
                }
            });
        }
        
        // ===== Cycle Tracking =====
        case ActionTypes.UPDATE_CYCLE_SETTINGS: {
            return {
                ...state,
                cycle: {
                    ...state.cycle,
                    ...payload
                }
            };
        }
        
        case ActionTypes.LOG_PERIOD: {
            const newPeriod = {
                id: `period-${Date.now()}`,
                startDate: payload.startDate,
                endDate: payload.endDate || null,
                flow: payload.flow || null,
                notes: payload.notes || ''
            };
            return {
                ...state,
                cycle: {
                    ...state.cycle,
                    periods: [...(state.cycle?.periods || []), newPeriod]
                }
            };
        }
        
        case ActionTypes.UPDATE_PERIOD: {
            return {
                ...state,
                cycle: {
                    ...state.cycle,
                    periods: (state.cycle?.periods || []).map(p =>
                        p.id === payload.id ? { ...p, ...payload } : p
                    )
                }
            };
        }
        
        case ActionTypes.DELETE_PERIOD: {
            return {
                ...state,
                cycle: {
                    ...state.cycle,
                    periods: (state.cycle?.periods || []).filter(p => p.id !== payload.id)
                }
            };
        }
        
        case ActionTypes.LOG_CYCLE_SYMPTOMS: {
            const dateKey = payload.date || DateUtils.toKey();
            return {
                ...state,
                cycle: {
                    ...state.cycle,
                    symptoms: {
                        ...(state.cycle?.symptoms || {}),
                        [dateKey]: { ...(state.cycle?.symptoms?.[dateKey] || {}), ...payload.symptoms }
                    }
                }
            };
        }
        
        case ActionTypes.LOAD_STATE: {
            return {
                ...state,
                ...payload,
                isLoading: false
            };
        }
        
        case ActionTypes.RESET_STATE: {
            return createInitialState();
        }
        
        default:
            return state;
    }
}

// ============================================================================
// SECTION 5: CUSTOM HOOKS
// ============================================================================

/**
 * Debounced localStorage persistence
 */
export function usePersistedState(state, isLoading) {
    const timeoutRef = useRef(null);
    
    useEffect(() => {
        if (isLoading) return;
        
        // Debounce writes
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        
        timeoutRef.current = setTimeout(() => {
            try {
                const toSave = {
                    // Existing fields
                    habits: state.habits,
                    habitOrder: state.habitOrder,
                    settings: state.settings,
                    streakFreezes: state.streakFreezes,
                    totalPoints: state.totalPoints,
                    
                    // New fields for StudentOS
                    studySessions: state.studySessions,
                    studyGoal: state.studyGoal,
                    subjects: state.subjects,
                    assignments: state.assignments,
                    expenses: state.expenses,
                    monthlyBudget: state.monthlyBudget,
                    expenseCategories: state.expenseCategories,
                    sleepLog: state.sleepLog,
                    waterLog: state.waterLog,
                    exerciseLog: state.exerciseLog,
                    moodLog: state.moodLog,
                    waterGoal: state.waterGoal,
                    sleepGoal: state.sleepGoal,
                    goals: state.goals,
                    goalCategories: state.goalCategories,
                    timetable: state.timetable,
                    journalEntries: state.journalEntries,
                    xp: state.xp,
                    level: state.level,
                    achievements: state.achievements,
                    dailyChallenges: state.dailyChallenges,
                    appVersion: state.appVersion,
                    _version: state._version || '3.0.0',
                    _lastSaved: new Date().toISOString(),
                    
                    // Grades
                    grades: state.grades,
                    
                    // Notifications
                    notifications: state.notifications,
                    
                    // Cognitive Command Center extensions
                    researchLog: state.researchLog,
                    skillXP: state.skillXP,
                    researchMilestones: state.researchMilestones,
                    
                    // Flashcards & Topics
                    flashcards: state.flashcards,
                    topics: state.topics,
                    
                    // Enhanced Focus Mode
                    focusMode: state.focusMode,
                    
                    // Grading schemes & templates
                    grading: state.grading,
                    
                    // Wellness Insights & Routines & Cycle
                    wellnessInsights: state.wellnessInsights,
                    routines: state.routines,
                    cycle: state.cycle
                };
                localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(toSave));
            } catch (e) {
                console.error('Failed to persist state:', e);
            }
        }, CONFIG.DEBOUNCE_MS);
        
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [state, isLoading]);
}

/**
 * Load state from localStorage on mount
 */
export function useLoadState(dispatch) {
    useEffect(() => {
        try {
            let saved = localStorage.getItem(CONFIG.STORAGE_KEY);
            
            // Try loading from previous version storage key for migration
            if (!saved) {
                saved = localStorage.getItem('studentos-v2');
                if (saved) {
                    // Migrate: save under new key and remove old
                    localStorage.setItem(CONFIG.STORAGE_KEY, saved);
                }
            }
            
            if (saved) {
                const parsed = JSON.parse(saved);
                // Ensure new fields exist for forward migration
                if (!parsed.grades) parsed.grades = { semesters: [] };
                if (!parsed.notifications) parsed.notifications = [];
                if (!parsed._version) parsed._version = '3.0.0';
                // Migrate grading schemes & templates
                if (!parsed.grading) {
                    parsed.grading = createInitialState().grading;
                }
                // Migrate flashcards
                if (!parsed.flashcards) {
                    parsed.flashcards = createInitialState().flashcards;
                }
                // Migrate topics
                if (!parsed.topics) {
                    parsed.topics = [];
                }
                // Migrate focus mode enhancements
                if (parsed.focusMode && !parsed.focusMode.mode) {
                    parsed.focusMode = { ...createInitialState().focusMode, ...parsed.focusMode };
                }
                // Migrate wellness insights
                if (!parsed.wellnessInsights) {
                    parsed.wellnessInsights = createInitialState().wellnessInsights;
                }
                // Migrate routines
                if (!parsed.routines) {
                    parsed.routines = createInitialState().routines;
                }
                // Migrate cycle tracking
                if (!parsed.cycle) {
                    parsed.cycle = createInitialState().cycle;
                }
                // Migrate subjects from string array to object array (only once)
                if (parsed.subjects && parsed.subjects.length > 0 && typeof parsed.subjects[0] === 'string') {
                    parsed.subjects = parsed.subjects.map((name, idx) => ({
                        id: `subj-migrated-${idx}`,
                        name,
                        color: Object.keys(CONFIG.COLORS)[idx % Object.keys(CONFIG.COLORS).length],
                        icon: '📘',
                        weeklyGoalHours: 5
                    }));
                    // Re-save immediately to persist migration
                    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify({ ...parsed, _version: '3.0.0' }));
                }
                dispatch({ type: ActionTypes.LOAD_STATE, payload: parsed });
            } else {
                dispatch({ type: ActionTypes.SET_LOADING, payload: false });
            }
        } catch (e) {
            console.error('Failed to load state:', e);
            dispatch({ type: ActionTypes.SET_LOADING, payload: false });
        }
    }, [dispatch]);
}

/**
 * Keyboard shortcuts
 */
export function useKeyboardShortcuts(dispatch, state) {
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Ctrl/Cmd + Z = Undo
            if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                dispatch({ type: ActionTypes.UNDO });
                showToast('Undone');
            }
            
            // Ctrl/Cmd + Shift + Z = Redo
            if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
                e.preventDefault();
                dispatch({ type: ActionTypes.REDO });
                showToast('Redone');
            }
            
            // Escape = Exit focus mode
            if (e.key === 'Escape' && state.focusMode.active) {
                dispatch({ type: ActionTypes.END_FOCUS });
            }
            
            // 1-5 = Switch views (only when not typing in an input)
            const activeTag = document.activeElement?.tagName?.toLowerCase();
            const isTyping = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select' || document.activeElement?.isContentEditable;
            if (!e.metaKey && !e.ctrlKey && !e.altKey && !isTyping) {
                const viewMap = { '1': 'dashboard', '2': 'command', '3': 'analytics', '4': 'study', '5': 'settings' };
                if (viewMap[e.key]) {
                    dispatch({ type: ActionTypes.SET_VIEW, payload: viewMap[e.key] });
                }
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [dispatch, state.focusMode.active]);
}

/**
 * Online/offline detection
 */
export function useOnlineStatus() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);
    
    return isOnline;
}

// ============================================================================
// SECTION 6: UI UTILITIES
// ============================================================================

/**
 * Show a toast notification
 * @param {string} message - Message to show
 * @param {string} [type='info'] - Type: info, success, error
 */
export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toast.setAttribute('role', 'alert');
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, CONFIG.TOAST_DURATION_MS);
}

/**
 * Trigger haptic feedback if supported and enabled
 * @param {string} [type='light'] - Type: light, medium, heavy
 */
export function haptic(type = 'light') {
    if (!navigator.vibrate) return;
    
    const patterns = {
        light: [10],
        medium: [20],
        heavy: [30, 10, 30]
    };
    
    navigator.vibrate(patterns[type] || patterns.light);
}

// ============================================================================
// SECTION 7: CONTEXT
// ============================================================================

export function useApp() {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useApp must be used within AppProvider');
    }
    return context;
}

// ============================================================================
// SECTION 8: COMPONENTS
// ============================================================================

// --- ATOMS (Basic building blocks) ---

/**
 * Accessible icon button
 */
export const InsightCard = memo(({ insight }) => {
    const typeStyles = {
        success: 'border-emerald-500/30 bg-emerald-500/5',
        warning: 'border-amber-500/30 bg-amber-500/5',
        urgent: 'border-rose-500/30 bg-rose-500/5 animate-pulse',
        info: 'border-sky-500/30 bg-sky-500/5',
        correlation: 'border-purple-500/30 bg-purple-500/5',
        celebration: 'border-amber-500/30 bg-amber-500/5'
    };
    
    return (
        <div 
            className={`p-4 rounded-xl border ${typeStyles[insight.type] || typeStyles.info}`}
            role="article"
            aria-label={insight.title}
        >
            <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0" role="img" aria-hidden="true">
                    {insight.icon}
                </span>
                <div>
                    <h4 className="font-semibold text-white text-sm">{insight.title}</h4>
                    <p className="text-slate-400 text-sm mt-1">{insight.message}</p>
                </div>
            </div>
        </div>
    );
});

/**
 * Stat card component
 */
export function generateWellnessAlerts(state, now = new Date()) {
    if (!state.wellnessInsights?.rulesEnabled) return [];
    
    const alerts = [];
    const thresholds = state.wellnessInsights?.thresholds || {};
    const dismissed = state.wellnessInsights?.dismissed || {};
    const todayKey = DateUtils.toKey(now);
    
    // Helper: get ISO week string for stable IDs
    const getWeekId = (d) => {
        const jan1 = new Date(d.getFullYear(), 0, 1);
        const weekNum = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
        return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    };
    const weekId = getWeekId(now);
    
    // Rule 1: Weekly sleep debt
    const sleepGoal = state.settings?.sleepGoal || state.sleepGoal || 8;
    const last7Days = [];
    for (let i = 0; i < 7; i++) {
        last7Days.push(DateUtils.toKey(DateUtils.addDays(now, -i)));
    }
    const totalSleep = (state.sleepLog || [])
        .filter(s => last7Days.includes(s.date))
        .reduce((sum, s) => sum + (s.hours || 0), 0);
    const sleepDebt = Math.max(0, sleepGoal * 7 - totalSleep);
    
    const sleepAlertId = `sleep-debt-${weekId}`;
    if (sleepDebt >= (thresholds.weeklySleepDebtHours || 5) && !dismissed[sleepAlertId]) {
        alerts.push({
            id: sleepAlertId,
            ruleId: 'sleepDebt',
            severity: sleepDebt >= 10 ? 'critical' : 'warning',
            title: '😴 Sleep Debt Alert',
            message: `You're short by ${sleepDebt.toFixed(1)}h of sleep over the last 7 days. Try a 20–30 min earlier bedtime tonight.`,
            createdAt: now.toISOString(),
            actionLink: { view: 'journal' },
            data: { sleepDebt, totalSleep, goal: sleepGoal * 7 }
        });
    }
    
    // Rule 2: Burnout rising + study load increasing
    const studySessions = state.studySessions || [];
    const thisWeekMins = studySessions
        .filter(s => last7Days.includes(s.date))
        .reduce((sum, s) => sum + (s.duration || 0), 0);
    
    const prev7Days = [];
    for (let i = 7; i < 14; i++) {
        prev7Days.push(DateUtils.toKey(DateUtils.addDays(now, -i)));
    }
    const prevWeekMins = studySessions
        .filter(s => prev7Days.includes(s.date))
        .reduce((sum, s) => sum + (s.duration || 0), 0);
    
    const studyIncreasePct = prevWeekMins > 0 ? ((thisWeekMins - prevWeekMins) / prevWeekMins) * 100 : 0;
    
    // Lightweight burnout proxy
    const sleepDebtNorm = Math.min(1, sleepDebt / 14);
    const studyNorm = Math.min(1, thisWeekMins / (40 * 60)); // 40h max
    
    // Mood trend (map emoji to numeric)
    const moodMap = { 'veryHappy': 5, 'happy': 4, 'neutral': 3, 'sad': 2, 'verySad': 1 };
    let moodScoreThisWeek = 0, moodCountThis = 0;
    let moodScorePrevWeek = 0, moodCountPrev = 0;
    last7Days.forEach(d => {
        const m = state.moodLog?.[d];
        if (m?.mood && moodMap[m.mood]) { moodScoreThisWeek += moodMap[m.mood]; moodCountThis++; }
    });
    prev7Days.forEach(d => {
        const m = state.moodLog?.[d];
        if (m?.mood && moodMap[m.mood]) { moodScorePrevWeek += moodMap[m.mood]; moodCountPrev++; }
    });
    const avgMoodThis = moodCountThis > 0 ? moodScoreThisWeek / moodCountThis : 3;
    const avgMoodPrev = moodCountPrev > 0 ? moodScorePrevWeek / moodCountPrev : 3;
    const moodNorm = Math.max(0, 1 - (avgMoodThis - 1) / 4); // lower mood = higher burnout
    
    const burnoutThis = (sleepDebtNorm * 0.35 + studyNorm * 0.35 + moodNorm * 0.3);
    
    const prevSleepDebt = Math.max(0, sleepGoal * 7 - (state.sleepLog || [])
        .filter(s => prev7Days.includes(s.date))
        .reduce((sum, s) => sum + (s.hours || 0), 0));
    const prevSleepNorm = Math.min(1, prevSleepDebt / 14);
    const prevStudyNorm = Math.min(1, prevWeekMins / (40 * 60));
    const prevMoodNorm = Math.max(0, 1 - (avgMoodPrev - 1) / 4);
    const burnoutPrev = (prevSleepNorm * 0.35 + prevStudyNorm * 0.35 + prevMoodNorm * 0.3);
    
    const burnoutDelta = burnoutThis - burnoutPrev;
    
    const burnoutAlertId = `burnout-rising-${weekId}`;
    if (burnoutDelta >= (thresholds.burnoutRisingDelta || 0.12) && 
        studyIncreasePct >= (thresholds.studyLoadIncreasePct || 25) &&
        !dismissed[burnoutAlertId]) {
        alerts.push({
            id: burnoutAlertId,
            ruleId: 'burnoutRising',
            severity: burnoutDelta > 0.25 && sleepDebt > 7 ? 'critical' : 'warning',
            title: '🔥 Burnout Risk Rising',
            message: `Burnout risk trending up (+${(burnoutDelta * 100).toFixed(0)}%) while study load rose ${studyIncreasePct.toFixed(0)}% week-over-week. Consider a lighter plan today + a recovery block.`,
            createdAt: now.toISOString(),
            actionLink: { view: 'study' },
            data: { burnoutDelta, studyIncreasePct, burnoutScore: burnoutThis }
        });
    }
    
    // Rule 3: Consecutive low mood
    const lowMoodThreshold = thresholds.consecutiveLowMoodDays || 3;
    let consecutiveLowMood = 0;
    for (let i = 0; i < 14; i++) {
        const dk = DateUtils.toKey(DateUtils.addDays(now, -i));
        const m = state.moodLog?.[dk];
        if (m?.mood && (m.mood === 'sad' || m.mood === 'verySad')) {
            consecutiveLowMood++;
        } else if (m?.mood) {
            break;
        }
    }
    
    const moodAlertId = `low-mood-streak-${todayKey}`;
    if (consecutiveLowMood >= lowMoodThreshold && !dismissed[moodAlertId]) {
        alerts.push({
            id: moodAlertId,
            ruleId: 'consecutiveLowMood',
            severity: consecutiveLowMood >= 5 ? 'warning' : 'info',
            title: '💙 Mood Check-in',
            message: `You've been feeling low for ${consecutiveLowMood} days in a row. Consider reaching out to a friend, taking a walk, or doing something you enjoy.`,
            createdAt: now.toISOString(),
            actionLink: { view: 'journal' },
            data: { consecutiveLowMood }
        });
    }
    
    return alerts;
}

// ============================================================================
// WELLNESS ALERTS CARD
// ============================================================================

export const MatrixView = memo(() => {
    const { state, dispatch } = useApp();
    
    const quadrantHabits = useMemo(() => {
        const result = { q1: [], q2: [], q3: [], q4: [] };
        
        state.habitOrder.forEach(id => {
            const habit = state.habits[id];
            if (!habit || habit.archived) return;
            const q = habit.quadrant || 'q2';
            result[q].push(habit);
        });
        
        return result;
    }, [state.habits, state.habitOrder]);
    
    const handleDrop = useCallback((habitId, newQuadrant) => {
        dispatch({
            type: ActionTypes.UPDATE_HABIT,
            payload: { id: habitId, updates: { quadrant: newQuadrant } }
        });
        showToast('Habit moved', 'success');
    }, [dispatch]);
    
    const QuadrantBox = ({ quadrantKey, quadrant, habits }) => {
        const [isDragOver, setIsDragOver] = useState(false);
        
        const colorClasses = {
            q1: 'border-rose-500/30 bg-rose-500/5',
            q2: 'border-purple-500/30 bg-purple-500/5',
            q3: 'border-amber-500/30 bg-amber-500/5',
            q4: 'border-slate-500/30 bg-slate-500/5'
        };
        
        const headerColors = {
            q1: 'text-rose-400',
            q2: 'text-purple-400',
            q3: 'text-amber-400',
            q4: 'text-slate-400'
        };
        
        return (
            <div
                className={`rounded-xl p-4 border-2 transition-all min-h-[200px] ${
                    isDragOver 
                        ? 'border-indigo-500 bg-indigo-500/10' 
                        : colorClasses[quadrantKey]
                }`}
                onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    const habitId = e.dataTransfer.getData('habitId');
                    if (habitId) handleDrop(habitId, quadrantKey);
                }}
            >
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h3 className={`font-bold text-sm ${headerColors[quadrantKey]}`}>
                            {quadrant.name}
                        </h3>
                        <p className="text-xs text-slate-500">{quadrant.description}</p>
                    </div>
                    <Badge>{habits.length}</Badge>
                </div>
                
                <div className="space-y-2">
                    {habits.map(habit => (
                        <div
                            key={habit.id}
                            draggable
                            onDragStart={(e) => e.dataTransfer.setData('habitId', habit.id)}
                            className="p-3 bg-slate-800/80 rounded-lg border border-slate-700 cursor-move hover:border-indigo-500/50 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <div 
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: CONFIG.COLORS[habit.color]?.bg }}
                                />
                                <span className="text-sm text-white truncate">{habit.name}</span>
                            </div>
                        </div>
                    ))}
                    
                    {habits.length === 0 && (
                        <p className="text-xs text-slate-500 text-center py-4">
                            Drag habits here
                        </p>
                    )}
                </div>
            </div>
        );
    };
    
    return (
        <div className="p-4">
            <h2 className="text-xl font-bold text-white mb-4">Eisenhower Matrix</h2>
            <p className="text-sm text-slate-400 mb-6">
                Drag habits between quadrants to prioritize them.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.entries(CONFIG.QUADRANTS).map(([key, quadrant]) => (
                    <QuadrantBox
                        key={key}
                        quadrantKey={key}
                        quadrant={quadrant}
                        habits={quadrantHabits[key]}
                    />
                ))}
            </div>
        </div>
    );
});

/**
 * Analytics View with real statistics
 */
export const AnalyticsView = memo(() => {
    const { state } = useApp();
    const canvasRef = useRef(null);
    
    const analyticsData = useMemo(() => {
        const activeHabits = state.habitOrder
            .map(id => state.habits[id])
            .filter(h => h && !h.archived);
        
        // Daily completion rates for last 30 days
        const dailyRates = [];
        for (let i = 29; i >= 0; i--) {
            const date = DateUtils.daysAgo(i);
            const key = DateUtils.toKey(date);
            let completed = 0;
            activeHabits.forEach(h => {
                if (h.data?.[key]) completed++;
            });
            const rate = activeHabits.length > 0 
                ? Math.round((completed / activeHabits.length) * 100) 
                : 0;
            dailyRates.push({ date: key, rate });
        }
        
        // Day of week analysis
        const dayOfWeekData = [0, 0, 0, 0, 0, 0, 0].map(() => ({ completed: 0, total: 0 }));
        activeHabits.forEach(habit => {
            Object.keys(habit.data || {}).forEach(key => {
                const day = DateUtils.dayOfWeek(key);
                dayOfWeekData[day].total++;
                if (habit.data[key]) dayOfWeekData[day].completed++;
            });
        });
        
        const dayOfWeekRates = dayOfWeekData.map(d => 
            d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0
        );
        
        // Trend calculation
        const recentRates = dailyRates.slice(-7).map(d => d.rate);
        const trend = StatsUtils.trend(recentRates);
        
        // Moving average
        const movingAvg = StatsUtils.movingAverage(dailyRates.map(d => d.rate), 7);
        
        return {
            dailyRates,
            dayOfWeekRates,
            trend,
            movingAvg,
            habitCount: activeHabits.length
        };
    }, [state.habits, state.habitOrder]);
    
    // Draw chart
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const padding = 40;
        
        // Clear
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, width, height);
        
        // Draw grid
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = padding + (i / 4) * (height - 2 * padding);
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(width - padding, y);
            ctx.stroke();
            
            // Y-axis labels
            ctx.fillStyle = '#64748b';
            ctx.font = '10px Inter, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(`${100 - i * 25}%`, padding - 8, y + 4);
        }
        
        // Draw data
        const data = analyticsData.dailyRates;
        const pointWidth = (width - 2 * padding) / (data.length - 1);
        
        // Area fill
        ctx.beginPath();
        ctx.moveTo(padding, height - padding);
        data.forEach((d, i) => {
            const x = padding + i * pointWidth;
            const y = padding + ((100 - d.rate) / 100) * (height - 2 * padding);
            ctx.lineTo(x, y);
        });
        ctx.lineTo(padding + (data.length - 1) * pointWidth, height - padding);
        ctx.closePath();
        
        const gradient = ctx.createLinearGradient(0, padding, 0, height - padding);
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.3)');
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Line
        ctx.beginPath();
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2;
        data.forEach((d, i) => {
            const x = padding + i * pointWidth;
            const y = padding + ((100 - d.rate) / 100) * (height - 2 * padding);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
        
        // Moving average line
        ctx.beginPath();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        analyticsData.movingAvg.forEach((rate, i) => {
            const x = padding + i * pointWidth;
            const y = padding + ((100 - rate) / 100) * (height - 2 * padding);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.setLineDash([]);
        
    }, [analyticsData]);
    
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    return (
        <div className="p-4 space-y-6">
            <h2 className="text-xl font-bold text-white">Analytics</h2>
            
            {analyticsData.habitCount === 0 ? (
                <EmptyState
                    icon="📊"
                    title="No data yet"
                    description="Complete some habits to see your analytics."
                />
            ) : (
                <>
                    {/* Trend indicator */}
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm text-slate-400">7-Day Trend</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-2xl">
                                        {analyticsData.trend.direction === 'up' ? '📈' : 
                                         analyticsData.trend.direction === 'down' ? '📉' : '➡️'}
                                    </span>
                                    <span className={`text-lg font-bold ${
                                        analyticsData.trend.direction === 'up' ? 'text-emerald-400' :
                                        analyticsData.trend.direction === 'down' ? 'text-rose-400' :
                                        'text-slate-400'
                                    }`}>
                                        {analyticsData.trend.direction === 'up' ? 'Improving' :
                                         analyticsData.trend.direction === 'down' ? 'Declining' :
                                         'Stable'}
                                    </span>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs text-slate-500">Slope</div>
                                <div className="font-mono text-sm text-slate-300">
                                    {analyticsData.trend.slope.toFixed(3)}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* 30-day chart */}
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                        <h3 className="text-sm text-slate-400 mb-4">30-Day Completion Rate</h3>
                        <canvas 
                            ref={canvasRef} 
                            width={600} 
                            height={200}
                            className="w-full h-auto"
                            role="img"
                            aria-label="30-day completion rate chart"
                        />
                        <div className="flex justify-center gap-4 mt-3 text-xs">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-indigo-500 rounded" />
                                <span className="text-slate-400">Daily Rate</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-0.5 bg-amber-500" />
                                <span className="text-slate-400">7-Day Average</span>
                            </div>
                        </div>
                    </div>
                    
                    {/* Day of week performance */}
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                        <h3 className="text-sm text-slate-400 mb-4">Performance by Day</h3>
                        <div className="grid grid-cols-7 gap-2">
                            {analyticsData.dayOfWeekRates.map((rate, i) => (
                                <div key={i} className="text-center">
                                    <div className="text-xs text-slate-500 mb-2">{dayNames[i]}</div>
                                    <div 
                                        className="mx-auto w-8 rounded-t-sm transition-all"
                                        style={{ 
                                            height: `${Math.max(rate, 5)}px`,
                                            backgroundColor: rate >= 70 ? '#10b981' : rate >= 40 ? '#f59e0b' : '#64748b'
                                        }}
                                    />
                                    <div className="text-xs font-medium text-slate-300 mt-1">{rate}%</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    {/* Statistical summary */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                            <div className="text-xs text-slate-500">Pearson Consistency</div>
                            <div className="text-xl font-bold text-white mt-1">
                                {(() => {
                                    const rates = analyticsData.dailyRates.map(d => d.rate);
                                    const indices = rates.map((_, i) => i);
                                    const corr = StatsUtils.pearsonCorrelation(indices, rates);
                                    return corr.toFixed(2);
                                })()}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">-1 to 1 scale</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                            <div className="text-xs text-slate-500">Std Deviation</div>
                            <div className="text-xl font-bold text-white mt-1">
                                {StatsUtils.stdDev(analyticsData.dailyRates.map(d => d.rate)).toFixed(1)}%
                            </div>
                            <div className="text-xs text-slate-500 mt-1">Consistency measure</div>
                        </div>
                    </div>
                </>
            )}
            
            {/* ===== Flashcard Analytics ===== */}
            {(() => {
                const reviews = state.flashcards?.reviews || [];
                const cards = state.flashcards?.cards || [];
                if (reviews.length === 0 && cards.length === 0) return null;
                
                const last30 = reviews.filter(r => new Date(r.reviewedAt) > new Date(Date.now() - 30 * 86400000));
                const todayKey = DateUtils.toKey();
                const todayRevs = reviews.filter(r => r.reviewedAt?.startsWith(todayKey)).length;
                const retention = last30.length > 0 ? Math.round(last30.filter(r => r.grade >= 2).length / last30.length * 100) : 0;
                
                const dailyCounts = [];
                for (let i = 6; i >= 0; i--) {
                    const d = new Date(Date.now() - i * 86400000);
                    const key = DateUtils.toKey(d);
                    dailyCounts.push({ day: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()], count: reviews.filter(r => r.reviewedAt?.startsWith(key)).length });
                }
                const maxCt = Math.max(1, ...dailyCounts.map(d => d.count));
                
                return (
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
                        <h3 className="text-sm font-semibold text-white">🃏 Flashcard Stats</h3>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="text-center"><div className="text-lg font-bold text-indigo-400">{todayRevs}</div><div className="text-[10px] text-slate-400">Today</div></div>
                            <div className="text-center"><div className="text-lg font-bold text-emerald-400">{retention}%</div><div className="text-[10px] text-slate-400">Retention (30d)</div></div>
                            <div className="text-center"><div className="text-lg font-bold text-amber-400">{cards.length}</div><div className="text-[10px] text-slate-400">Total Cards</div></div>
                        </div>
                        <div className="text-xs text-slate-400 mb-1">Reviews / day (7d)</div>
                        <div className="flex items-end gap-1 h-16">
                            {dailyCounts.map((d, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                                    <div className="w-full bg-indigo-500/30 rounded-t" style={{height: `${Math.max(4, (d.count / maxCt) * 100)}%`}} />
                                    <span className="text-[9px] text-slate-500">{d.day}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}
        </div>
    );
});

/**
 * Settings View
 */
export const SettingsView = memo(() => {
    const { state, dispatch } = useApp();
    const fileInputRef = useRef(null);
    
    const handleExport = () => {
        const data = {
            _version: CONFIG.VERSION,
            exportedAt: new Date().toISOString(),
            habits: state.habits,
            habitOrder: state.habitOrder,
            settings: state.settings,
            subjects: state.subjects,
            studySessions: state.studySessions,
            assignments: state.assignments,
            timetable: state.timetable,
            expenses: state.expenses,
            sleepLog: state.sleepLog,
            waterLog: state.waterLog,
            exerciseLog: state.exerciseLog,
            moodLog: state.moodLog,
            journalEntries: state.journalEntries,
            goals: state.goals,
            grades: state.grades,
            xp: state.xp,
            level: state.level,
            achievements: state.achievements,
            streakFreezes: state.streakFreezes,
            totalPoints: state.totalPoints
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `studentos-backup-${DateUtils.toKey()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Data exported', 'success');
    };
    
    const handleImport = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                
                if (!data.habits || !data.habitOrder) {
                    throw new Error('Invalid backup format');
                }
                
                if (confirm(`Import ${Object.keys(data.habits).length} habits? This will replace your current data.`)) {
                    dispatch({
                        type: ActionTypes.LOAD_STATE,
                        payload: {
                            habits: data.habits,
                            habitOrder: data.habitOrder,
                            settings: data.settings || state.settings,
                            streakFreezes: data.streakFreezes ?? 2,
                            totalPoints: data.totalPoints ?? 0
                        }
                    });
                    showToast('Data imported successfully', 'success');
                }
            } catch (err) {
                console.error(err);
                showToast('Invalid backup file', 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };
    
    const handleReset = () => {
        if (confirm('Reset ALL data? This cannot be undone!')) {
            if (confirm('Are you REALLY sure? All habits and history will be deleted.')) {
                dispatch({ type: ActionTypes.RESET_STATE });
                localStorage.removeItem(CONFIG.STORAGE_KEY);
                showToast('All data reset', 'info');
            }
        }
    };
    
    return (
        <div className="p-4 space-y-6">
            <h2 className="text-xl font-bold text-white">Settings</h2>
            
            {/* App Info */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-2xl">
                        📚
                    </div>
                    <div>
                        <h3 className="font-bold text-white">{CONFIG.APP_NAME}</h3>
                        <p className="text-xs text-slate-400">Version {CONFIG.VERSION}</p>
                    </div>
                </div>
            </div>
            
            {/* Quick Access */}
            <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-300">Quick Access</h3>
                
                {[
                    { view: 'expenses', icon: '💰', title: 'Expense Tracker', desc: 'Manage your budget' },
                    { view: 'matrix', icon: '📊', title: 'Eisenhower Matrix', desc: 'Priority quadrants' },
                    { view: 'grades', icon: '📈', title: 'Grade Tracker', desc: 'Track your GPA' },
                    { view: 'goals', icon: '🎯', title: 'Goal System', desc: 'Track goals and milestones' },
                    { view: 'calendar', icon: '📅', title: 'Calendar', desc: 'View all events' },
                ].map(item => (
                    <button key={item.view}
                        onClick={() => dispatch({ type: ActionTypes.SET_VIEW, payload: item.view })}
                        className="w-full flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-slate-700 hover:bg-slate-800 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-xl">{item.icon}</span>
                            <div className="text-left">
                                <div className="font-medium text-white">{item.title}</div>
                                <div className="text-xs text-slate-400">{item.desc}</div>
                            </div>
                        </div>
                        <span className="text-slate-400">→</span>
                    </button>
                ))}
            </div>
            
            {/* Theme */}
            <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-300">Theme</h3>
                <div className="flex gap-2">
                    {['dark', 'light', 'amoled'].map(theme => (
                        <button key={theme}
                            onClick={() => {
                                dispatch({ type: ActionTypes.UPDATE_SETTINGS, payload: { theme } });
                                document.body.className = theme === 'dark' ? '' : theme;
                            }}
                            className={`flex-1 py-2 rounded-xl text-sm font-medium capitalize ${
                                state.settings.theme === theme
                                    ? 'bg-indigo-500 text-white'
                                    : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}>
                            {theme === 'amoled' ? 'AMOLED' : theme}
                        </button>
                    ))}
                </div>
            </div>
            
            {/* Currency */}
            <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-300">Currency</h3>
                <div className="flex gap-2 flex-wrap">
                    {['₹', '$', '€', '£', '¥'].map(c => (
                        <button key={c}
                            onClick={() => dispatch({ type: ActionTypes.UPDATE_SETTINGS, payload: { currency: c } })}
                            className={`px-4 py-2 rounded-xl text-sm font-medium ${
                                state.settings.currency === c
                                    ? 'bg-indigo-500 text-white'
                                    : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}>
                            {c}
                        </button>
                    ))}
                </div>
            </div>
            
            {/* Cycle Tracking */}
            <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-300">Tracking</h3>
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                    <div className="flex items-center justify-between py-2">
                        <div>
                            <div className="text-sm text-white">Cycle Tracking</div>
                            <div className="text-xs text-slate-400">Local only, private</div>
                        </div>
                        <button 
                            onClick={() => dispatch({ type: ActionTypes.UPDATE_CYCLE_SETTINGS, payload: { enabled: !state.cycle?.enabled } })}
                            className={`w-12 h-6 rounded-full transition-colors ${state.cycle?.enabled ? 'bg-pink-500' : 'bg-slate-600'}`}
                            aria-label="Toggle cycle tracking"
                        >
                            <div className={`w-5 h-5 bg-white rounded-full transition-transform ${state.cycle?.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                        </button>
                    </div>
                </div>
            </div>
            
            {/* Data Management */}
            <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-300">Data Management</h3>
                
                <button
                    onClick={handleExport}
                    className="w-full flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-slate-700 hover:bg-slate-800 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <span className="text-xl">💾</span>
                        <div className="text-left">
                            <div className="font-medium text-white">Export Data</div>
                            <div className="text-xs text-slate-400">Download backup file</div>
                        </div>
                    </div>
                    <span className="text-slate-400">→</span>
                </button>
                
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-slate-700 hover:bg-slate-800 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <span className="text-xl">📂</span>
                        <div className="text-left">
                            <div className="font-medium text-white">Import Data</div>
                            <div className="text-xs text-slate-400">Restore from backup</div>
                        </div>
                    </div>
                    <span className="text-slate-400">→</span>
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    className="hidden"
                />
                
                <button
                    onClick={handleReset}
                    className="w-full flex items-center justify-between p-4 bg-rose-500/10 rounded-xl border border-rose-500/30 hover:bg-rose-500/20 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <span className="text-xl">🗑️</span>
                        <div className="text-left">
                            <div className="font-medium text-rose-400">Reset All Data</div>
                            <div className="text-xs text-rose-400/70">Delete everything</div>
                        </div>
                    </div>
                    <span className="text-rose-400">→</span>
                </button>
            </div>
            
            {/* Statistics */}
            <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-300">Your Stats</h3>
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                        <div className="text-2xl font-bold text-white">
                            {Object.keys(state.habits).length}
                        </div>
                        <div className="text-xs text-slate-400">Total Habits</div>
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                        <div className="text-2xl font-bold text-white">
                            {Object.values(state.habits).reduce((sum, h) => 
                                sum + Object.keys(h.data || {}).length, 0
                            )}
                        </div>
                        <div className="text-xs text-slate-400">Total Completions</div>
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                        <div className="text-2xl font-bold text-white">
                            {state.totalPoints}
                        </div>
                        <div className="text-xs text-slate-400">Points Earned</div>
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                        <div className="text-2xl font-bold text-white">
                            {state.streakFreezes}
                        </div>
                        <div className="text-xs text-slate-400">Streak Freezes</div>
                    </div>
                </div>
            </div>
            
            {/* Keyboard Shortcuts */}
            <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-300">Keyboard Shortcuts</h3>
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-slate-400">Undo</span>
                        <kbd className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300">Ctrl/⌘ + Z</kbd>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-400">Redo</span>
                        <kbd className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300">Ctrl/⌘ + Shift + Z</kbd>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-400">Navigate Views</span>
                        <kbd className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300">1, 2, 3, 4</kbd>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-400">Exit Focus Mode</span>
                        <kbd className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300">Esc</kbd>
                    </div>
                </div>
            </div>
            
            {/* Credits */}
            <div className="text-center pt-6 text-xs text-slate-500">
                <p>Built with React, Tailwind CSS, and ❤️</p>
                <p className="mt-1">Real statistics. No fake AI.</p>
            </div>
        </div>
    );
});

// --- TEMPLATES (Full page layouts) ---

/**
 * Dashboard Page
 */
export const DashboardPage = memo(() => {
    const { state, dispatch } = useApp();
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingHabitId, setEditingHabitId] = useState(null);
    const [focusHabitId, setFocusHabitId] = useState(null);
    
    const today = DateUtils.toKey();
    
    // Calculate widget stats
    const todayStudyTime = useMemo(() => {
        return state.studySessions
            .filter(s => s.date === today)
            .reduce((sum, s) => sum + s.duration, 0);
    }, [state.studySessions, today]);
    
    const nextAssignment = useMemo(() => {
        const pending = state.assignments
            .filter(a => a.status !== 'completed' && new Date(a.dueDate) >= new Date())
            .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
        return pending[0];
    }, [state.assignments]);
    
    const upcomingExams = useMemo(() => {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        return state.assignments
            .filter(a => a.type === 'exam' && a.status !== 'completed' && new Date(a.dueDate) >= todayStart)
            .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    }, [state.assignments]);
    
    const todayWater = state.waterLog[today] || 0;
    const todaySleep = state.sleepLog.find(s => s.date === today);
    
    const handleStartFocus = useCallback((habitId) => {
        setFocusHabitId(habitId);
    }, []);
    
    const handleFocusComplete = useCallback((habitId) => {
        dispatch({ type: ActionTypes.TOGGLE_HABIT, payload: { id: habitId } });
    }, [dispatch]);
    
    // Calculate best habit streak
    const bestStreak = useMemo(() => {
        const habits = Object.values(state.habits).filter(h => !h.archived);
        if (habits.length === 0) return { name: 'None', days: 0 };
        
        const habitStreaks = habits.map(h => ({
            name: h.name,
            days: HabitUtils.calculateStreak(h.data)
        }));
        
        return habitStreaks.reduce((best, current) => 
            current.days > best.days ? current : best
        , { name: 'None', days: 0 });
    }, [state.habits]);
    
    return (
        <>
            {/* Motivational Quote */}
            <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-xl p-4 border border-indigo-500/20 mb-6">
                <p className="text-sm text-slate-300 italic">
                    "{MOTIVATIONAL_QUOTES[new Date().getDate() + new Date().getMonth() * 31 % MOTIVATIONAL_QUOTES.length]}"
                </p>
            </div>
            
            <StatsOverview />
            
            {/* Quick Access Widgets */}
            <div className="grid grid-cols-2 gap-3 mb-6">
                {/* Study Widget */}
                <button
                    onClick={() => dispatch({ type: ActionTypes.SET_VIEW, payload: 'study' })}
                    className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-xl p-4 border border-indigo-500/20 text-left hover:from-indigo-500/20 hover:to-purple-500/20 transition-all"
                >
                    <div className="text-2xl mb-1">⏱️</div>
                    <div className="text-lg font-bold text-white">{Math.floor(todayStudyTime / 60)}h {todayStudyTime % 60}m</div>
                    <div className="text-xs text-slate-400">Study Today</div>
                </button>
                
                {/* Next Assignment Widget */}
                <button
                    onClick={() => dispatch({ type: ActionTypes.SET_VIEW, payload: 'study' })}
                    className="bg-gradient-to-br from-amber-500/10 to-rose-500/10 rounded-xl p-4 border border-amber-500/20 text-left hover:from-amber-500/20 hover:to-rose-500/20 transition-all"
                >
                    <div className="text-2xl mb-1">📝</div>
                    <div className="text-sm font-bold text-white truncate">
                        {nextAssignment ? nextAssignment.title : 'No tasks'}
                    </div>
                    <div className="text-xs text-slate-400">
                        {nextAssignment ? 
                            `Due ${Math.ceil((new Date(nextAssignment.dueDate) - new Date()) / (1000 * 60 * 60 * 24))}d` 
                            : 'All clear!'}
                    </div>
                </button>
                
                {/* Wellness Widget */}
                <button
                    onClick={() => dispatch({ type: ActionTypes.SET_VIEW, payload: 'journal' })}
                    className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 rounded-xl p-4 border border-emerald-500/20 text-left hover:from-emerald-500/20 hover:to-cyan-500/20 transition-all"
                >
                    <div className="text-2xl mb-1">💧</div>
                    <div className="text-lg font-bold text-white">{todayWater}/{state.waterGoal}</div>
                    <div className="text-xs text-slate-400">Water Today</div>
                </button>
                
                {/* XP Widget */}
                <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl p-4 border border-purple-500/20">
                    <div className="text-2xl mb-1">🏆</div>
                    <div className="text-lg font-bold text-white">Level {state.level}</div>
                    <div className="text-xs text-slate-400">{state.xp} XP</div>
                </div>
            </div>
            
            {/* Upcoming Exams Reminder */}
            {upcomingExams.length > 0 && (
                <div className="bg-gradient-to-r from-rose-500/10 to-amber-500/10 rounded-xl p-4 border border-rose-500/20 mb-2">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-lg">🎓</span>
                        <h3 className="font-bold text-white text-sm">Upcoming Exams</h3>
                        <span className="text-xs bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded-full ml-auto">{upcomingExams.length}</span>
                    </div>
                    <div className="space-y-2">
                        {upcomingExams.slice(0, 3).map(exam => {
                            const examDate = new Date(exam.dueDate);
                            examDate.setHours(0, 0, 0, 0);
                            const now = new Date();
                            now.setHours(0, 0, 0, 0);
                            const daysLeft = Math.ceil((examDate - now) / (1000 * 60 * 60 * 24));
                            const prepProg = exam.prepProgress || exam.progress || 0;
                            return (
                                <div key={exam.id} className="bg-slate-800/50 rounded-lg p-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-white truncate">{exam.title}</div>
                                            <div className="text-xs text-slate-400">{exam.subject} · {exam.dueDate}</div>
                                        </div>
                                        <div className={`text-sm font-bold ml-3 ${
                                            daysLeft <= 1 ? 'text-rose-400' : daysLeft <= 3 ? 'text-amber-400' : daysLeft <= 7 ? 'text-yellow-400' : 'text-emerald-400'
                                        }`}>
                                            {daysLeft < 0 ? 'Overdue' : daysLeft === 0 ? 'Today!' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft}d`}
                                        </div>
                                    </div>
                                    {prepProg > 0 ? (
                                        <div className="mt-2">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs text-slate-400">Prep Progress</span>
                                                <span className={`text-xs font-semibold ${
                                                    prepProg >= 75 ? 'text-emerald-400' : prepProg >= 50 ? 'text-yellow-400' : 'text-amber-400'
                                                }`}>{prepProg}%</span>
                                            </div>
                                            <div className="w-full bg-slate-700 rounded-full h-1.5">
                                                <div className={`h-1.5 rounded-full transition-all ${
                                                    prepProg >= 75 ? 'bg-emerald-500' : prepProg >= 50 ? 'bg-yellow-500' : 'bg-amber-500'
                                                }`} style={{ width: `${Math.min(prepProg, 100)}%` }}></div>
                                            </div>
                                            {prepProg < 50 && (
                                                <div className="text-xs text-amber-400/80 mt-1">Keep going — still a lot to cover! 💪</div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="mt-2 text-xs text-slate-500">No prep started yet — time to begin! 📖</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {upcomingExams.length > 3 && (
                        <button 
                            onClick={() => dispatch({ type: ActionTypes.SET_VIEW, payload: 'study' })}
                            className="text-xs text-indigo-400 hover:text-indigo-300 mt-2 transition-colors"
                        >
                            View all {upcomingExams.length} exams →
                        </button>
                    )}
                </div>
            )}
            
            {/* Wellness Features */}
            <WellnessAlertsCard />
            <RoutinesSection />
            <CycleTrackingCard />
            
            {/* Insights Panel */}
            <InsightsPanel />
            
            {/* Today's Habits */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-white text-lg">Today's Habits</h2>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="text-indigo-400 text-sm font-medium hover:text-indigo-300 transition-colors"
                >
                    + Add Habit
                </button>
            </div>
            
            <HabitsList 
                onEdit={setEditingHabitId}
                onStartFocus={handleStartFocus}
            />
            
            {/* Best Streak Card */}
            {bestStreak.days > 0 && (
                <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-xl p-4 border border-orange-500/20 mt-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm text-slate-400 mb-1">🔥 Current Best Streak</div>
                            <div className="text-lg font-bold text-white">{bestStreak.name}</div>
                        </div>
                        <div className="text-3xl font-bold text-orange-400">{bestStreak.days}d</div>
                    </div>
                </div>
            )}
            
            {/* Modals */}
            {showAddModal && (
                <HabitModal onClose={() => setShowAddModal(false)} />
            )}
            
            {editingHabitId && (
                <HabitModal 
                    habitId={editingHabitId} 
                    onClose={() => setEditingHabitId(null)} 
                />
            )}
            
            {focusHabitId && (
                <FocusTimer
                    habitId={focusHabitId}
                    onClose={() => setFocusHabitId(null)}
                    onComplete={handleFocusComplete}
                />
            )}
        </>
    );
});

/**
 * Study View - Study sessions, assignments, and timetable
 */
export const StudyView = memo(() => {
    const { state, dispatch } = useApp();
    const [activeTab, setActiveTab] = useState('timer'); // timer, assignments, timetable
    const [showStudyTimer, setShowStudyTimer] = useState(false);
    const [showAssignmentModal, setShowAssignmentModal] = useState(false);
    const [editingAssignment, setEditingAssignment] = useState(null);
    const [defaultExamType, setDefaultExamType] = useState(false);
    const [showTimetableModal, setShowTimetableModal] = useState(false);
    const [editingTimetableEntry, setEditingTimetableEntry] = useState(null);
    
    // Calculate today's study time
    const todayStudyTime = useMemo(() => {
        const today = DateUtils.toKey();
        return state.studySessions
            .filter(s => s.date === today)
            .reduce((sum, s) => sum + s.duration, 0);
    }, [state.studySessions]);
    
    // Get pending assignments
    const pendingAssignments = useMemo(() => {
        return state.assignments
            .filter(a => a.status !== 'completed' && a.type !== 'exam')
            .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    }, [state.assignments]);
    
    // Get upcoming exams
    const pendingExams = useMemo(() => {
        return state.assignments
            .filter(a => a.type === 'exam' && a.status !== 'completed')
            .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    }, [state.assignments]);
    
    // Calculate days until due
    const getDaysUntil = (dueDate) => {
        const days = Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));
        return days;
    };
    
    const getUrgencyColor = (daysUntil) => {
        if (daysUntil < 0) return 'text-slate-500';
        if (daysUntil <= 1) return 'text-rose-400';
        if (daysUntil <= 3) return 'text-amber-400';
        return 'text-emerald-400';
    };
    
    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-white mb-2">📚 Study Hub</h2>
                <p className="text-slate-400 text-sm">Track study sessions, manage assignments, and view your timetable</p>
            </div>
            
            {/* Tab Navigation */}
            <div className="flex gap-2 bg-slate-800/50 p-1 rounded-xl overflow-x-auto">
                {[
                    { id: 'timer', label: 'Timer', icon: '⏱️' },
                    { id: 'flashcards', label: 'Cards', icon: '🃏' },
                    { id: 'topics', label: 'Topics', icon: '📑' },
                    { id: 'exams', label: 'Exams', icon: '🎓' },
                    { id: 'assignments', label: 'Tasks', icon: '📝' },
                    { id: 'timetable', label: 'Timetable', icon: '📅' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                            activeTab === tab.id
                                ? 'bg-indigo-500 text-white'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <span className="mr-2">{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>
            
            {/* Content */}
            {activeTab === 'timer' && (
                <div className="space-y-4">
                    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                        <div className="text-center py-8">
                            <div className="text-4xl mb-4">⏱️</div>
                            <h3 className="text-lg font-semibold text-white mb-2">Study Timer</h3>
                            <p className="text-slate-400 mb-4">Track your study sessions with Pomodoro support</p>
                            <button
                                onClick={() => setShowStudyTimer(true)}
                                className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium transition-colors"
                            >
                                Start Study Session
                            </button>
                        </div>
                    </div>
                    
                    {/* Recent Sessions */}
                    {state.studySessions.length > 0 && (
                        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                            <h4 className="text-sm font-semibold text-white mb-3">Recent Sessions</h4>
                            <div className="space-y-2">
                                {state.studySessions.slice(-5).reverse().map(session => (
                                    <div key={session.id} className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
                                        <div>
                                            <div className="text-sm font-medium text-white">{session.subject}</div>
                                            <div className="text-xs text-slate-400">{session.date}</div>
                                        </div>
                                        <div className="text-sm font-semibold text-indigo-400">{session.duration}m</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            {activeTab === 'exams' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <button
                            onClick={() => {
                                setEditingAssignment(null);
                                setDefaultExamType(true);
                                setShowAssignmentModal(true);
                            }}
                            className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-medium transition-colors"
                        >
                            + Add Exam
                        </button>
                    </div>
                    
                    {pendingExams.length > 0 ? (
                        <div className="space-y-3">
                            {pendingExams.map(exam => {
                                const daysUntil = getDaysUntil(exam.dueDate);
                                return (
                                    <div key={exam.id} className={`bg-slate-800/50 rounded-xl p-4 border ${
                                        daysUntil <= 1 ? 'border-rose-500/50' : daysUntil <= 3 ? 'border-amber-500/40' : daysUntil <= 7 ? 'border-yellow-500/30' : 'border-slate-700'
                                    }`}>
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-lg">🎓</span>
                                                    <h4 className="text-sm font-semibold text-white">{exam.title}</h4>
                                                </div>
                                                <div className="text-xs text-slate-400">{exam.subject} · {exam.dueDate}</div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setEditingAssignment(exam);
                                                    setDefaultExamType(false);
                                                    setShowAssignmentModal(true);
                                                }}
                                                className="text-slate-400 hover:text-white text-sm"
                                            >
                                                Edit
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between mt-3">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-bold px-2 py-1 rounded ${
                                                    daysUntil <= 0 ? 'bg-rose-500/20 text-rose-400' :
                                                    daysUntil <= 1 ? 'bg-rose-500/20 text-rose-400' :
                                                    daysUntil <= 3 ? 'bg-amber-500/20 text-amber-400' :
                                                    daysUntil <= 7 ? 'bg-yellow-500/20 text-yellow-400' :
                                                    'bg-emerald-500/20 text-emerald-400'
                                                }`}>
                                                    {daysUntil < 0 ? 'OVERDUE' : daysUntil === 0 ? 'TODAY!' : daysUntil === 1 ? 'TOMORROW' : `${daysUntil} DAYS LEFT`}
                                                </span>
                                                <span className={`text-xs px-2 py-1 rounded ${
                                                    exam.priority === 'high' ? 'bg-rose-500/20 text-rose-400' :
                                                    exam.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                                                    'bg-slate-500/20 text-slate-400'
                                                }`}>
                                                    {exam.priority}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    dispatch({
                                                        type: ActionTypes.UPDATE_ASSIGNMENT,
                                                        payload: { id: exam.id, updates: { status: 'completed' } }
                                                    });
                                                    showToast('Exam completed! +50 XP 🎉', 'success');
                                                }}
                                                className="text-xs px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded transition-colors"
                                            >
                                                Done ✓
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 text-center">
                            <div className="text-4xl mb-4">🎓</div>
                            <h3 className="text-lg font-semibold text-white mb-2">No Upcoming Exams</h3>
                            <p className="text-slate-400 mb-4">Add your exams to get countdown reminders</p>
                            <button
                                onClick={() => {
                                    setEditingAssignment(null);
                                    setDefaultExamType(true);
                                    setShowAssignmentModal(true);
                                }}
                                className="px-6 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-medium transition-colors"
                            >
                                Add Exam
                            </button>
                        </div>
                    )}
                </div>
            )}
            
            {activeTab === 'assignments' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <button
                            onClick={() => {
                                setEditingAssignment(null);
                                setDefaultExamType(false);
                                setShowAssignmentModal(true);
                            }}
                            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors"
                        >
                            + Add Assignment
                        </button>
                    </div>
                    
                    {pendingAssignments.length > 0 ? (
                        <div className="space-y-3">
                            {pendingAssignments.map(assignment => {
                                const daysUntil = getDaysUntil(assignment.dueDate);
                                return (
                                    <div key={assignment.id} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-lg">
                                                        {assignment.type === 'exam' ? '📝' : '📄'}
                                                    </span>
                                                    <h4 className="text-sm font-semibold text-white">{assignment.title}</h4>
                                                </div>
                                                <div className="text-xs text-slate-400">{assignment.subject}</div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setEditingAssignment(assignment);
                                                    setDefaultExamType(false);
                                                    setShowAssignmentModal(true);
                                                }}
                                                className="text-slate-400 hover:text-white text-sm"
                                            >
                                                Edit
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between mt-3">
                                            <span className={`text-xs font-medium ${getUrgencyColor(daysUntil)}`}>
                                                {daysUntil < 0 ? 'Overdue' : daysUntil === 0 ? 'Due today' : `${daysUntil} days left`}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs px-2 py-1 rounded ${
                                                    assignment.priority === 'high' ? 'bg-rose-500/20 text-rose-400' :
                                                    assignment.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                                                    'bg-slate-500/20 text-slate-400'
                                                }`}>
                                                    {assignment.priority}
                                                </span>
                                                <button
                                                    onClick={() => {
                                                        dispatch({
                                                            type: ActionTypes.UPDATE_ASSIGNMENT,
                                                            payload: { id: assignment.id, updates: { status: 'completed' } }
                                                        });
                                                        showToast('Assignment completed! +30 XP', 'success');
                                                    }}
                                                    className="text-xs px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded transition-colors"
                                                >
                                                    Complete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 text-center">
                            <div className="text-4xl mb-4">📝</div>
                            <h3 className="text-lg font-semibold text-white mb-2">No Assignments</h3>
                            <p className="text-slate-400 mb-4">Add your first assignment to get started</p>
                        </div>
                    )}
                </div>
            )}
            
            {activeTab === 'timetable' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-white">Weekly Timetable</h3>
                        <button 
                            onClick={() => {
                                setEditingTimetableEntry(null);
                                setShowTimetableModal(true);
                            }}
                            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-medium transition-colors"
                        >
                            + Add Class
                        </button>
                    </div>
                    
                    {state.timetable.length === 0 ? (
                        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 text-center">
                            <div className="text-4xl mb-4">📅</div>
                            <h3 className="text-lg font-semibold text-white mb-2">No Classes Yet</h3>
                            <p className="text-slate-400 mb-4">Add your class schedule to stay organized</p>
                            <button 
                                onClick={() => {
                                    setEditingTimetableEntry(null);
                                    setShowTimetableModal(true);
                                }}
                                className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium transition-colors"
                            >
                                Add Class
                            </button>
                        </div>
                    ) : (
                        ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
                            .filter(day => state.timetable.some(t => t.day === day))
                            .map(day => (
                                <div key={day} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                                    <h4 className="text-sm font-semibold text-indigo-400 mb-3">{day}</h4>
                                    <div className="space-y-2">
                                        {state.timetable
                                            .filter(t => t.day === day)
                                            .sort((a, b) => a.startTime.localeCompare(b.startTime))
                                            .map(t => (
                                                <div key={t.id} className="flex items-center justify-between bg-slate-700/50 rounded-lg p-3">
                                                    <div className="flex-1">
                                                        <div className="font-medium text-white text-sm">{t.subject}</div>
                                                        <div className="text-xs text-slate-400">
                                                            {t.startTime} - {t.endTime}
                                                            {t.room && <span> · {t.room}</span>}
                                                        </div>
                                                        {t.notes && <div className="text-xs text-slate-500 mt-1">{t.notes}</div>}
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => {
                                                                setEditingTimetableEntry(t);
                                                                setShowTimetableModal(true);
                                                            }}
                                                            className="p-1.5 text-slate-400 hover:text-white transition-colors"
                                                            aria-label="Edit class"
                                                        >
                                                            ✏️
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                dispatch({ type: ActionTypes.DELETE_TIMETABLE_ENTRY, payload: { id: t.id } });
                                                                showToast('Class removed');
                                                            }}
                                                            className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors"
                                                            aria-label="Delete class"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            ))
                    )}
                </div>
            )}
            
            {/* ===== FLASHCARDS TAB ===== */}
            {activeTab === 'flashcards' && (() => {
                const decks = state.flashcards?.decks || [];
                const allCards = state.flashcards?.cards || [];
                const allReviews = state.flashcards?.reviews || [];
                const activeDeckId = state.flashcards?.ui?.activeDeckId;
                const activeDeck = decks.find(d => d.id === activeDeckId);
                const now = new Date();
                const todayKey = DateUtils.toKey();
                
                const getDeckCounts = (deckId) => {
                    const dc = allCards.filter(c => c.deckId === deckId && !c.suspended);
                    return {
                        due: dc.filter(c => c.state === 'review' && c.dueAt && new Date(c.dueAt) <= now).length,
                        learning: dc.filter(c => c.state === 'learning' && c.dueAt && new Date(c.dueAt) <= now).length,
                        newCards: dc.filter(c => c.state === 'new').length,
                        total: dc.length
                    };
                };
                
                if (!activeDeckId) {
                    return (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-white">Flashcard Decks</h3>
                                <button onClick={() => {
                                    const name = prompt('Deck name:');
                                    if (!name?.trim()) return;
                                    dispatch({ type: ActionTypes.ADD_DECK, payload: {
                                        id: crypto.randomUUID(), subjectId: state.subjects[0]?.id || null, name: name.trim(), createdAt: new Date().toISOString(),
                                        settings: { newPerDay: 20, reviewPerDay: 100, learningStepsMins: [10, 1440], easeFactorBase: 2.5 }
                                    }});
                                    showToast('Deck created', 'success');
                                }} className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-medium">+ New Deck</button>
                            </div>
                            {decks.length === 0 ? (
                                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 text-center">
                                    <div className="text-4xl mb-4">🃏</div>
                                    <h3 className="text-lg font-semibold text-white mb-2">No Decks Yet</h3>
                                    <p className="text-slate-400">Create flashcard decks for spaced repetition study</p>
                                </div>
                            ) : decks.map(deck => {
                                const cn = getDeckCounts(deck.id);
                                const subj = state.subjects.find(s => s.id === deck.subjectId);
                                return (
                                    <div key={deck.id} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 cursor-pointer hover:bg-slate-800/80"
                                        onClick={() => dispatch({ type: ActionTypes.SET_ACTIVE_DECK, payload: deck.id })}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                {subj && <span className="w-3 h-3 rounded-full" style={{backgroundColor: CONFIG.COLORS[subj.color]?.bg || '#6366f1'}} />}
                                                <span className="font-medium text-white">{deck.name}</span>
                                            </div>
                                            <button onClick={e => { e.stopPropagation(); if(confirm('Delete deck?')) dispatch({ type: ActionTypes.DELETE_DECK, payload: deck.id }); }}
                                                className="text-rose-400 hover:text-rose-300 text-xs p-1" aria-label="Delete deck">🗑️</button>
                                        </div>
                                        <div className="flex gap-3 text-xs">
                                            <span className="text-blue-400">{cn.due} due</span>
                                            <span className="text-amber-400">{cn.learning} learning</span>
                                            <span className="text-emerald-400">{cn.newCards} new</span>
                                            <span className="text-slate-400">{cn.total} total</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                }
                
                const DeckDetail = () => {
                    const [reviewMode, setReviewMode] = React.useState(false);
                    const [showAns, setShowAns] = React.useState(false);
                    const [cardStart, setCardStart] = React.useState(Date.now());
                    const [revCt, setRevCt] = React.useState(0);
                    const [okCt, setOkCt] = React.useState(0);
                    const [addingCard, setAddingCard] = React.useState(false);
                    const [cFront, setCFront] = React.useState('');
                    const [cBack, setCBack] = React.useState('');
                    const [cTags, setCTags] = React.useState('');
                    const [cTopic, setCTopic] = React.useState('');
                    const [browse, setBrowse] = React.useState(false);
                    const [sq, setSq] = React.useState('');
                    
                    const dc = allCards.filter(c => c.deckId === activeDeckId && !c.suspended);
                    const cn = getDeckCounts(activeDeckId);
                    const stg = activeDeck?.settings || { newPerDay: 20, reviewPerDay: 100 };
                    
                    const queue = useMemo(() => {
                        const lr = dc.filter(c => c.state === 'learning' && c.dueAt && new Date(c.dueAt) <= now);
                        const rv = dc.filter(c => c.state === 'review' && c.dueAt && new Date(c.dueAt) <= now).slice(0, stg.reviewPerDay);
                        const nw = dc.filter(c => c.state === 'new').slice(0, stg.newPerDay);
                        return [...lr, ...rv, ...nw];
                    }, [dc, stg]);
                    
                    const cur = reviewMode && queue.length > 0 ? queue[0] : null;
                    const sTopics = (state.topics || []).filter(t => t.subjectId === activeDeck?.subjectId);
                    
                    if (reviewMode && !cur) return (
                        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 text-center">
                            <div className="text-4xl mb-3">🎉</div>
                            <h3 className="text-lg font-bold text-white mb-2">Session Complete!</h3>
                            <p className="text-slate-400 mb-4">Reviewed: {revCt} • Accuracy: {revCt > 0 ? Math.round(okCt/revCt*100) : 0}%</p>
                            <button onClick={() => {setReviewMode(false);setRevCt(0);setOkCt(0);}} className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium">Done</button>
                        </div>
                    );
                    
                    if (reviewMode && cur) return (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <button onClick={() => setReviewMode(false)} className="text-slate-400 hover:text-white text-sm">← Back</button>
                                <span className="text-xs text-slate-400">{queue.length} remaining</span>
                            </div>
                            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 min-h-[200px] flex flex-col items-center justify-center text-center">
                                <div className="text-white text-lg mb-4 whitespace-pre-wrap">{cur.front}</div>
                                {!showAns ? (
                                    <button onClick={() => setShowAns(true)} className="px-8 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium">Show Answer</button>
                                ) : (
                                    <div className="space-y-4 w-full">
                                        <div className="border-t border-slate-700 pt-4"><div className="text-indigo-300 text-lg whitespace-pre-wrap">{cur.back}</div></div>
                                        <div className="grid grid-cols-4 gap-2">
                                            {[{g:0,l:'Again',cl:'bg-rose-500/20 text-rose-400 border-rose-500/30'},{g:1,l:'Hard',cl:'bg-amber-500/20 text-amber-400 border-amber-500/30'},{g:2,l:'Good',cl:'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'},{g:3,l:'Easy',cl:'bg-blue-500/20 text-blue-400 border-blue-500/30'}].map(b => (
                                                <button key={b.g} onClick={() => {
                                                    dispatch({type:ActionTypes.REVIEW_CARD,payload:{cardId:cur.id,grade:b.g,timeMs:Date.now()-cardStart}});
                                                    setShowAns(false);setCardStart(Date.now());setRevCt(r=>r+1);if(b.g>=2)setOkCt(c=>c+1);
                                                }} className={`py-2 rounded-lg text-sm font-medium border ${b.cl}`}>{b.l}</button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                    
                    if (browse) {
                        const fl = allCards.filter(c => c.deckId === activeDeckId && (c.front.toLowerCase().includes(sq.toLowerCase()) || c.back.toLowerCase().includes(sq.toLowerCase())));
                        return (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <button onClick={() => setBrowse(false)} className="text-slate-400 hover:text-white text-sm">← Back</button>
                                    <span className="text-xs text-slate-400">{fl.length} cards</span>
                                </div>
                                <input type="text" value={sq} onChange={e => setSq(e.target.value)} placeholder="Search cards..." className="w-full px-3 py-2 bg-slate-800 rounded-lg border border-slate-600 text-white text-sm" />
                                {fl.map(c => (
                                    <div key={c.id} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-white truncate">{c.front}</div>
                                                <div className="text-xs text-slate-400 truncate">{c.back}</div>
                                                <div className="text-[10px] text-slate-500 mt-1">{c.state} • EF:{(c.easeFactor||2.5).toFixed(1)} • IV:{c.intervalDays||0}d{c.suspended?' • SUSPENDED':''}</div>
                                            </div>
                                            <div className="flex gap-1">
                                                <button onClick={() => dispatch({type:ActionTypes.TOGGLE_SUSPEND_CARD,payload:c.id})} className="text-xs px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded">{c.suspended?'Unsuspend':'Suspend'}</button>
                                                <button onClick={() => dispatch({type:ActionTypes.DELETE_CARD,payload:c.id})} className="text-rose-400 text-xs p-0.5" aria-label="Delete card">✕</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    }
                    
                    return (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <button onClick={() => dispatch({type:ActionTypes.SET_ACTIVE_DECK,payload:null})} className="text-slate-400 hover:text-white text-sm">← All Decks</button>
                                <h3 className="font-medium text-white">{activeDeck?.name}</h3>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/20 text-center"><div className="text-xl font-bold text-blue-400">{cn.due}</div><div className="text-[10px] text-slate-400">Due</div></div>
                                <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/20 text-center"><div className="text-xl font-bold text-amber-400">{cn.learning}</div><div className="text-[10px] text-slate-400">Learning</div></div>
                                <div className="bg-emerald-500/10 rounded-lg p-3 border border-emerald-500/20 text-center"><div className="text-xl font-bold text-emerald-400">{cn.newCards}</div><div className="text-[10px] text-slate-400">New</div></div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => {setReviewMode(true);setShowAns(false);setCardStart(Date.now());setRevCt(0);setOkCt(0);}} disabled={queue.length===0}
                                    className={`flex-1 py-3 rounded-xl font-medium text-sm ${queue.length>0?'bg-indigo-500 hover:bg-indigo-600 text-white':'bg-slate-700 text-slate-500'}`}>🔄 Review ({queue.length})</button>
                                <button onClick={() => setAddingCard(true)} className="flex-1 py-3 bg-emerald-500/20 text-emerald-400 rounded-xl font-medium text-sm border border-emerald-500/30">+ Add Card</button>
                            </div>
                            <button onClick={() => setBrowse(true)} className="w-full py-2 text-indigo-400 text-sm hover:bg-indigo-500/10 rounded-lg border border-dashed border-slate-700">📖 Browse ({allCards.filter(c => c.deckId === activeDeckId).length} cards)</button>
                            {addingCard && (
                                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={() => setAddingCard(false)}>
                                    <div className="w-full max-w-lg mx-4 bg-slate-900 rounded-t-2xl sm:rounded-2xl p-5 border border-slate-700" onClick={e => e.stopPropagation()}>
                                        <h3 className="text-lg font-bold text-white mb-3">Add Flashcard</h3>
                                        <div className="space-y-3">
                                            <textarea value={cFront} onChange={e => setCFront(e.target.value)} placeholder="Front (question)" className="w-full px-3 py-2 bg-slate-800 rounded-lg border border-slate-600 text-white text-sm h-20 resize-none" />
                                            <textarea value={cBack} onChange={e => setCBack(e.target.value)} placeholder="Back (answer)" className="w-full px-3 py-2 bg-slate-800 rounded-lg border border-slate-600 text-white text-sm h-20 resize-none" />
                                            <input type="text" value={cTags} onChange={e => setCTags(e.target.value)} placeholder="Tags (comma separated)" className="w-full px-3 py-2 bg-slate-800 rounded-lg border border-slate-600 text-white text-sm" />
                                            {sTopics.length > 0 && <select value={cTopic} onChange={e => setCTopic(e.target.value)} className="w-full px-3 py-2 bg-slate-800 rounded-lg border border-slate-600 text-white text-sm"><option value="">Link to topic (optional)</option>{sTopics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select>}
                                        </div>
                                        <div className="flex gap-2 mt-4">
                                            <button onClick={() => setAddingCard(false)} className="flex-1 py-2 bg-slate-800 rounded-lg text-white text-sm">Cancel</button>
                                            <button onClick={() => {
                                                if (!cFront.trim()||!cBack.trim()) {showToast('Front and back required','error');return;}
                                                dispatch({type:ActionTypes.ADD_CARD,payload:{id:crypto.randomUUID(),deckId:activeDeckId,subjectId:activeDeck?.subjectId||null,front:cFront.trim(),back:cBack.trim(),tags:cTags.split(',').map(t=>t.trim()).filter(Boolean),topicId:cTopic||null,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),suspended:false,state:'new',dueAt:null,intervalDays:0,easeFactor:2.5,reps:0,lapses:0,lastReviewedAt:null}});
                                                setCFront('');setCBack('');setCTags('');setCTopic('');setAddingCard(false);showToast('Card added','success');
                                            }} className="flex-1 py-2 bg-indigo-500 rounded-lg text-white text-sm font-medium">Add Card</button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                };
                return <DeckDetail />;
            })()}
            
            {/* ===== TOPICS TAB ===== */}
            {activeTab === 'topics' && (() => {
                const TopicsPanel = () => {
                    const [selSubj, setSelSubj] = React.useState(state.subjects[0]?.id || '');
                    const [adding, setAdding] = React.useState(false);
                    const [tTitle, setTTitle] = React.useState('');
                    const [tHours, setTHours] = React.useState('');
                    const sTopics = useMemo(() => (state.topics||[]).filter(t => t.subjectId === selSubj).sort((a,b) => (a.order||0)-(b.order||0)), [state.topics, selSubj]);
                    const getTime = (tid) => state.studySessions.filter(s => s.topicId === tid).reduce((sum, s) => sum + s.duration, 0);
                    return (
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-white">Topics / Chapters</h3>
                            {state.subjects.length === 0 ? (
                                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 text-center"><div className="text-4xl mb-3">📑</div><p className="text-slate-400">Add subjects first to create topics</p></div>
                            ) : (
                                <div className="space-y-3">
                                    <select value={selSubj} onChange={e => setSelSubj(e.target.value)} className="w-full px-3 py-2 bg-slate-800 rounded-lg border border-slate-600 text-white text-sm">
                                        {state.subjects.map(s => <option key={s.id} value={s.id}>{typeof s==='string'?s:s.name}</option>)}
                                    </select>
                                    {sTopics.length === 0 && !adding && <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center"><p className="text-slate-400 text-sm">No topics yet</p></div>}
                                    {sTopics.map((topic, idx) => {
                                        const ts = getTime(topic.id);
                                        return (
                                            <div key={topic.id} className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-medium text-white">{topic.title}</span>
                                                    <div className="flex items-center gap-1">
                                                        <button onClick={() => dispatch({type:ActionTypes.REORDER_TOPIC,payload:{topicId:topic.id,direction:'up'}})} disabled={idx===0} className="text-slate-400 hover:text-white text-xs p-0.5 disabled:opacity-30" aria-label="Move up">▲</button>
                                                        <button onClick={() => dispatch({type:ActionTypes.REORDER_TOPIC,payload:{topicId:topic.id,direction:'down'}})} disabled={idx===sTopics.length-1} className="text-slate-400 hover:text-white text-xs p-0.5 disabled:opacity-30" aria-label="Move down">▼</button>
                                                        <button onClick={() => dispatch({type:ActionTypes.DELETE_TOPIC,payload:topic.id})} className="text-rose-400 hover:text-rose-300 text-xs p-0.5" aria-label="Delete topic">✕</button>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input type="range" min="0" max="100" value={topic.progress||0} onChange={e => dispatch({type:ActionTypes.UPDATE_TOPIC,payload:{id:topic.id,progress:Number(e.target.value),updatedAt:new Date().toISOString()}})} className="flex-1 h-1.5 accent-indigo-500" aria-label="Progress" />
                                                    <span className="text-xs text-indigo-400 font-medium w-10 text-right">{topic.progress||0}%</span>
                                                </div>
                                                <div className="flex items-center justify-between text-[10px] text-slate-400">
                                                    <span>⏱ {Math.floor(ts/60)}h {ts%60}m studied</span>
                                                    {topic.plannedHours > 0 && <span>📋 {topic.plannedHours}h planned</span>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {adding ? (
                                        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 space-y-2">
                                            <input type="text" value={tTitle} onChange={e => setTTitle(e.target.value)} placeholder="Topic / Chapter name" className="w-full px-3 py-2 bg-slate-800 rounded-lg border border-slate-600 text-white text-sm" autoFocus />
                                            <input type="number" value={tHours} onChange={e => setTHours(e.target.value)} placeholder="Planned hours (optional)" className="w-full px-3 py-2 bg-slate-800 rounded-lg border border-slate-600 text-white text-sm" min="0" />
                                            <div className="flex gap-2">
                                                <button onClick={() => {
                                                    if (!tTitle.trim()) return;
                                                    dispatch({type:ActionTypes.ADD_TOPIC,payload:{id:crypto.randomUUID(),subjectId:selSubj,title:tTitle.trim(),notes:'',order:sTopics.length,plannedHours:Number(tHours)||0,progress:0,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}});
                                                    setTTitle('');setTHours('');setAdding(false);showToast('Topic added','success');
                                                }} className="flex-1 py-2 bg-indigo-500 rounded-lg text-white text-sm font-medium">Add</button>
                                                <button onClick={() => {setAdding(false);setTTitle('');setTHours('');}} className="flex-1 py-2 bg-slate-700 rounded-lg text-slate-300 text-sm">Cancel</button>
                                            </div>
                                        </div>
                                    ) : <button onClick={() => setAdding(true)} className="w-full py-2 text-indigo-400 text-sm hover:bg-indigo-500/10 rounded-lg border border-dashed border-slate-700">+ Add Topic</button>}
                                </div>
                            )}
                        </div>
                    );
                };
                return <TopicsPanel />;
            })()}
            
            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                    <div className="text-2xl font-bold text-indigo-400">{Math.floor(todayStudyTime / 60)}h {todayStudyTime % 60}m</div>
                    <div className="text-xs text-slate-400">Study Today</div>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                    <div className="text-2xl font-bold text-rose-400">{pendingExams.length}</div>
                    <div className="text-xs text-slate-400">Upcoming Exams</div>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                    <div className="text-2xl font-bold text-amber-400">{pendingAssignments.length}</div>
                    <div className="text-xs text-slate-400">Pending Tasks</div>
                </div>
            </div>
            
            {/* Modals */}
            {showStudyTimer && <StudyTimer onClose={() => setShowStudyTimer(false)} />}
            {showAssignmentModal && (
                <AssignmentModal
                    assignment={editingAssignment}
                    defaultType={defaultExamType ? 'exam' : null}
                    onClose={() => {
                        setShowAssignmentModal(false);
                        setEditingAssignment(null);
                        setDefaultExamType(false);
                    }}
                />
            )}
            {showTimetableModal && (
                <TimetableModal
                    entry={editingTimetableEntry}
                    onClose={() => {
                        setShowTimetableModal(false);
                        setEditingTimetableEntry(null);
                    }}
                />
            )}
        </div>
    );
});

/**
 * Journal View - Daily journaling and mood tracking
 */
export const JournalView = memo(() => {
    const { state, dispatch } = useApp();
    const today = DateUtils.toKey();
    const todayEntry = state.journalEntries.find(e => e.date === today);
    const [showJournalModal, setShowJournalModal] = useState(false);
    const [viewingEntry, setViewingEntry] = useState(null);
    const [showWellnessModal, setShowWellnessModal] = useState(null); // 'sleep', 'water', 'exercise', 'mood'
    
    // Calculate wellness stats
    const todayWater = state.waterLog[today] || 0;
    const todaySleep = state.sleepLog.find(s => s.date === today);
    const todayExercise = state.exerciseLog.filter(e => e.date === today);
    const todayMood = state.moodLog[today];
    const todayExerciseTime = todayExercise.reduce((sum, e) => sum + e.duration, 0);
    
    // Calculate journal streak
    const journalStreak = useMemo(() => {
        let streak = 0;
        let currentDate = new Date();
        
        while (true) {
            const dateKey = DateUtils.toKey(currentDate);
            const hasEntry = state.journalEntries.some(e => e.date === dateKey);
            
            if (!hasEntry) break;
            streak++;
            currentDate.setDate(currentDate.getDate() - 1);
        }
        
        return streak;
    }, [state.journalEntries]);
    
    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-white mb-2">📓 Daily Journal</h2>
                <p className="text-slate-400 text-sm">Reflect on your day and track your wellness</p>
            </div>
            
            {/* Wellness Quick Stats */}
            <div className="grid grid-cols-4 gap-3">
                <button
                    onClick={() => setShowWellnessModal('sleep')}
                    className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 text-center hover:bg-slate-800 transition-colors"
                >
                    <div className="text-2xl mb-1">💤</div>
                    <div className="text-xs text-slate-400">Sleep</div>
                    <div className="text-sm font-semibold text-white">
                        {todaySleep ? `${todaySleep.hours}h` : '-'}
                    </div>
                </button>
                <button
                    onClick={() => setShowWellnessModal('water')}
                    className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 text-center hover:bg-slate-800 transition-colors"
                >
                    <div className="text-2xl mb-1">💧</div>
                    <div className="text-xs text-slate-400">Water</div>
                    <div className="text-sm font-semibold text-white">{todayWater}/{state.waterGoal}</div>
                </button>
                <button
                    onClick={() => setShowWellnessModal('exercise')}
                    className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 text-center hover:bg-slate-800 transition-colors"
                >
                    <div className="text-2xl mb-1">🏃</div>
                    <div className="text-xs text-slate-400">Exercise</div>
                    <div className="text-sm font-semibold text-white">{todayExerciseTime}m</div>
                </button>
                <button
                    onClick={() => setShowWellnessModal('mood')}
                    className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 text-center hover:bg-slate-800 transition-colors"
                >
                    <div className="text-2xl mb-1">{todayMood?.mood ? CONFIG.MOODS[todayMood.mood] : '😐'}</div>
                    <div className="text-xs text-slate-400">Mood</div>
                    <div className="text-sm font-semibold text-white">
                        {todayMood ? `${todayMood.energy}/5` : '-'}
                    </div>
                </button>
            </div>
            
            {/* Journal Entry */}
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                {todayEntry ? (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">{CONFIG.MOODS[todayEntry.mood]}</span>
                                <div>
                                    <h3 className="text-lg font-semibold text-white">Today's Entry</h3>
                                    <p className="text-xs text-slate-400">{todayEntry.wordCount} words</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowJournalModal(true)}
                                className="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
                            >
                                Edit
                            </button>
                        </div>
                        <p className="text-slate-300 whitespace-pre-wrap mb-3">{todayEntry.content}</p>
                        {todayEntry.gratitude && (
                            <div className="bg-indigo-500/10 rounded-lg p-3 border border-indigo-500/20">
                                <div className="text-xs text-indigo-400 font-medium mb-1">Grateful for:</div>
                                <div className="text-sm text-white">{todayEntry.gratitude}</div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <div className="text-4xl mb-4">✍️</div>
                        <h3 className="text-lg font-semibold text-white mb-2">No Entry Yet</h3>
                        <p className="text-slate-400 mb-4">Start journaling to track your thoughts and progress</p>
                        <button
                            onClick={() => setShowJournalModal(true)}
                            className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium transition-colors"
                        >
                            Write Entry
                        </button>
                    </div>
                )}
            </div>
            
            {/* Streak & Recent Entries */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 rounded-xl p-4 border border-purple-500/20">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-2xl font-bold text-purple-400">{journalStreak} days</div>
                            <div className="text-sm text-slate-400">Journal Streak</div>
                        </div>
                        <div className="text-4xl">🔥</div>
                    </div>
                </div>
                
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                    <div className="text-sm font-semibold text-white mb-2">Total Entries</div>
                    <div className="text-2xl font-bold text-indigo-400">{state.journalEntries.length}</div>
                </div>
            </div>
            
            {/* Recent Entries */}
            {state.journalEntries.length > 1 && (
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                    <h4 className="text-sm font-semibold text-white mb-3">Recent Entries</h4>
                    <div className="space-y-2">
                        {state.journalEntries
                            .sort((a, b) => new Date(b.date) - new Date(a.date))
                            .slice(1, 6)
                            .map(entry => (
                                <div key={entry.id} className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl">{CONFIG.MOODS[entry.mood]}</span>
                                        <div>
                                            <div className="text-sm font-medium text-white">{entry.date}</div>
                                            <div className="text-xs text-slate-400">{entry.wordCount} words</div>
                                        </div>
                                    </div>
                                    <button onClick={() => setViewingEntry(entry)} aria-label={`View journal entry from ${entry.date}`} className="text-xs text-indigo-400 hover:text-indigo-300">View</button>
                                </div>
                            ))}
                    </div>
                </div>
            )}
            
            {/* Modals */}
            {showJournalModal && (
                <JournalEntryModal
                    entry={todayEntry}
                    onClose={() => setShowJournalModal(false)}
                />
            )}
            {showWellnessModal && (
                <WellnessModal
                    type={showWellnessModal}
                    onClose={() => setShowWellnessModal(null)}
                />
            )}
            {viewingEntry && (
                <JournalEntryModal
                    entry={viewingEntry}
                    onClose={() => setViewingEntry(null)}
                />
            )}
        </div>
    );
});

/**
 * Expense Modal - Add/Edit Expense
 */
export const ExpenseView = memo(() => {
    const { state, dispatch } = useApp();
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [editingExpense, setEditingExpense] = useState(null);
    const [timeFilter, setTimeFilter] = useState('month'); // day, week, month
    const [editingBudget, setEditingBudget] = useState(false);
    const [budgetInput, setBudgetInput] = useState(state.monthlyBudget);
    const currency = state.settings.currency || '₹';
    
    // Calculate filtered expenses
    const filteredExpenses = useMemo(() => {
        const now = new Date();
        const today = DateUtils.toKey();
        
        return state.expenses.filter(e => {
            if (timeFilter === 'day') return e.date === today;
            if (timeFilter === 'week') {
                const expenseDate = new Date(e.date);
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                return expenseDate >= weekAgo;
            }
            if (timeFilter === 'month') {
                const expenseDate = new Date(e.date);
                return expenseDate.getMonth() === now.getMonth() && 
                       expenseDate.getFullYear() === now.getFullYear();
            }
            return true;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [state.expenses, timeFilter]);
    
    // Calculate total and category breakdown
    const stats = useMemo(() => {
        const total = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
        const byCategory = {};
        
        filteredExpenses.forEach(e => {
            byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
        });
        
        return { total, byCategory };
    }, [filteredExpenses]);
    
    const budgetRemaining = state.monthlyBudget - stats.total;
    const budgetPercentage = (stats.total / state.monthlyBudget) * 100;
    
    const getCategoryIcon = (category) => {
        const icons = {
            'Food': '🍔',
            'Transport': '🚗',
            'Books': '📚',
            'Entertainment': '🎮',
            'Subscriptions': '💳',
            'Health': '⚕️',
            'Other': '📦'
        };
        return icons[category] || '💰';
    };
    
    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-white mb-2">💰 Expense Tracker</h2>
                <p className="text-slate-400 text-sm">Track your spending and stay within budget</p>
            </div>
            
            {/* Budget Overview */}
            <div className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 rounded-xl p-6 border border-emerald-500/20">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <div className="text-sm text-slate-400 mb-1">Spent This Month</div>
                        <div className="text-3xl font-bold text-white">{currency}{stats.total.toFixed(2)}</div>
                        <div className="text-sm text-slate-400">of {currency}{state.monthlyBudget}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-sm text-slate-400 mb-1">Remaining</div>
                        <div className={`text-2xl font-bold ${
                            budgetRemaining >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                            {currency}{Math.abs(budgetRemaining).toFixed(2)}
                        </div>
                    </div>
                </div>
                
                {/* Set Budget */}
                <div className="mb-3">
                    {editingBudget ? (
                        <div className="flex items-center gap-2">
                            <span className="text-slate-400 text-sm">{currency}</span>
                            <input
                                type="number"
                                min="0"
                                step="100"
                                value={budgetInput}
                                onChange={(e) => setBudgetInput(e.target.value)}
                                className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                                autoFocus
                            />
                            <button
                                onClick={() => {
                                    const val = parseFloat(budgetInput);
                                    if (val > 0) {
                                        dispatch({ type: ActionTypes.SET_MONTHLY_BUDGET, payload: { budget: val } });
                                        showToast('Monthly budget updated!', 'success');
                                        setEditingBudget(false);
                                    } else {
                                        showToast('Please enter a valid budget amount', 'error');
                                    }
                                }}
                                className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-white text-sm font-medium transition-colors"
                            >
                                Save
                            </button>
                            <button
                                onClick={() => { setEditingBudget(false); setBudgetInput(state.monthlyBudget); }}
                                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm font-medium transition-colors"
                            >
                                ✕
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => { setBudgetInput(state.monthlyBudget); setEditingBudget(true); }}
                            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                            ✏️ Set Monthly Budget
                        </button>
                    )}
                </div>
                
                {/* Progress Bar */}
                <div className="bg-slate-800 rounded-full h-3 overflow-hidden">
                    <div
                        className={`h-full transition-all duration-500 ${
                            budgetPercentage >= 100 ? 'bg-rose-500' :
                            budgetPercentage >= 80 ? 'bg-amber-500' :
                            'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
                    />
                </div>
                <div className="text-xs text-slate-400 mt-1 text-right">{budgetPercentage.toFixed(0)}% used</div>
            </div>
            
            {/* Time Filter */}
            <div className="flex gap-2 bg-slate-800/50 p-1 rounded-xl">
                {[
                    { id: 'day', label: 'Today' },
                    { id: 'week', label: 'Week' },
                    { id: 'month', label: 'Month' }
                ].map(filter => (
                    <button
                        key={filter.id}
                        onClick={() => setTimeFilter(filter.id)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                            timeFilter === filter.id
                                ? 'bg-indigo-500 text-white'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        {filter.label}
                    </button>
                ))}
            </div>
            
            {/* Category Breakdown */}
            {Object.keys(stats.byCategory).length > 0 && (
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                    <h4 className="text-sm font-semibold text-white mb-3">Category Breakdown</h4>
                    <div className="space-y-2">
                        {Object.entries(stats.byCategory)
                            .sort(([, a], [, b]) => b - a)
                            .map(([category, amount]) => (
                                <div key={category} className="flex items-center gap-3">
                                    <span className="text-xl">{getCategoryIcon(category)}</span>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm text-white">{category}</span>
                                            <span className="text-sm font-semibold text-white">{currency}{amount.toFixed(2)}</span>
                                        </div>
                                        <div className="bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className="h-full bg-indigo-500"
                                                style={{ width: `${(amount / stats.total) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
            )}
            
            {/* Add Expense Button */}
            <button
                onClick={() => {
                    setEditingExpense(null);
                    setShowExpenseModal(true);
                }}
                className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium transition-colors"
            >
                + Add Expense
            </button>
            
            {/* Recent Expenses */}
            {filteredExpenses.length > 0 ? (
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                    <h4 className="text-sm font-semibold text-white mb-3">Recent Expenses</h4>
                    <div className="space-y-2">
                        {filteredExpenses.slice(0, 10).map(expense => (
                            <div key={expense.id} className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">{getCategoryIcon(expense.category)}</span>
                                    <div>
                                        <div className="text-sm font-medium text-white">
                                            {expense.description || expense.category}
                                        </div>
                                        <div className="text-xs text-slate-400">{expense.date}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-semibold text-white">{currency}{expense.amount.toFixed(2)}</span>
                                    <button
                                        onClick={() => {
                                            setEditingExpense(expense);
                                            setShowExpenseModal(true);
                                        }}
                                        className="text-xs text-indigo-400 hover:text-indigo-300"
                                    >
                                        Edit
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 text-center">
                    <div className="text-4xl mb-4">💰</div>
                    <h3 className="text-lg font-semibold text-white mb-2">No Expenses Yet</h3>
                    <p className="text-slate-400">Start tracking your spending to stay within budget</p>
                </div>
            )}
            
            {/* Modal */}
            {showExpenseModal && (
                <ExpenseModal
                    expense={editingExpense}
                    onClose={() => {
                        setShowExpenseModal(false);
                        setEditingExpense(null);
                    }}
                />
            )}
        </div>
    );
});

// ============================================================================
// SECTION 8B: COMMAND DASHBOARD — Cognitive Command Center UI
// Bloomberg Terminal + Linear + GitHub Insights aesthetic
// ============================================================================

/**
 * Cognitive Load Indicator Bar
 * Green: Optimal, Yellow: Rising strain, Red: Burnout > threshold
 */
export const CognitiveLoadBar = memo(({ value, level }) => {
    const colors = {
        green: { bg: 'bg-emerald-500', text: 'text-emerald-400', label: 'OPTIMAL' },
        yellow: { bg: 'bg-amber-500', text: 'text-amber-400', label: 'ELEVATED' },
        red: { bg: 'bg-rose-500', text: 'text-rose-400', label: 'CRITICAL' }
    };
    const c = colors[level] || colors.green;
    return (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Cognitive Load</span>
                <span className={`text-xs font-bold font-mono ${c.text}`}>{c.label} — {value}%</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full ${c.bg} transition-all duration-700`} style={{ width: `${value}%` }} />
            </div>
        </div>
    );
});

/**
 * Metric Card — compact analytical display
 */
export const MetricCard = memo(({ label, value, suffix, trend, detail, color = 'indigo' }) => {
    const trendIcons = { up: '↑', down: '↓', stable: '→' };
    const trendColors = { up: 'text-emerald-400', down: 'text-rose-400', stable: 'text-slate-500' };
    const colorMap = {
        indigo: 'text-indigo-400', emerald: 'text-emerald-400', amber: 'text-amber-400',
        rose: 'text-rose-400', purple: 'text-purple-400', cyan: 'text-cyan-400',
        sky: 'text-sky-400', orange: 'text-orange-400'
    };
    return (
        <div className="bg-slate-900/80 border border-slate-700/60 rounded-lg p-3 hover:border-slate-600 transition-colors">
            <div className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-1">{label}</div>
            <div className="flex items-end gap-1">
                <span className={`text-2xl font-bold font-mono ${colorMap[color] || colorMap.indigo}`}>{value}</span>
                {suffix && <span className="text-xs text-slate-500 mb-1">{suffix}</span>}
                {trend && <span className={`text-sm ml-1 mb-0.5 ${trendColors[trend] || ''}`}>{trendIcons[trend] || ''}</span>}
            </div>
            {detail && <div className="text-xs text-slate-500 mt-1 font-mono">{detail}</div>}
        </div>
    );
});

/**
 * Mini Heatmap — GitHub-style contribution grid
 */
export const MiniHeatmap = memo(({ data, label, weeks = 12 }) => {
    const totalDays = weeks * 7;
    const cells = data.slice(-totalDays);
    const maxCount = Math.max(1, ...cells.map(c => c.count));

    const getColor = (count) => {
        if (count === 0) return 'bg-slate-800';
        const intensity = count / maxCount;
        if (intensity > 0.75) return 'bg-emerald-500';
        if (intensity > 0.5) return 'bg-emerald-600';
        if (intensity > 0.25) return 'bg-emerald-700';
        return 'bg-emerald-800';
    };

    // Organize into weeks
    const weekGroups = [];
    for (let i = 0; i < cells.length; i += 7) {
        weekGroups.push(cells.slice(i, i + 7));
    }

    return (
        <div className="bg-slate-900/80 border border-slate-700/60 rounded-lg p-3">
            <div className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-2">{label}</div>
            <div className="flex gap-0.5 overflow-x-auto">
                {weekGroups.map((week, wi) => (
                    <div key={wi} className="flex flex-col gap-0.5">
                        {week.map((day, di) => (
                            <div
                                key={di}
                                className={`w-2.5 h-2.5 rounded-sm ${getColor(day.count)}`}
                                title={`${day.date}: ${day.count} activities`}
                            />
                        ))}
                    </div>
                ))}
            </div>
            <div className="flex items-center gap-1 mt-2">
                <span className="text-xs text-slate-600">Less</span>
                {['bg-slate-800', 'bg-emerald-800', 'bg-emerald-700', 'bg-emerald-600', 'bg-emerald-500'].map((c, i) => (
                    <div key={i} className={`w-2.5 h-2.5 rounded-sm ${c}`} />
                ))}
                <span className="text-xs text-slate-600">More</span>
            </div>
        </div>
    );
});

/**
 * Performance Radar Panel (text-based since no chart library)
 */
export const GradeTrackerView = memo(() => {
    const { state, dispatch } = useApp();
    const [showAddSemester, setShowAddSemester] = useState(false);
    const [semesterName, setSemesterName] = useState('');
    const [expandedSemester, setExpandedSemester] = useState(null);
    const [expandedCourse, setExpandedCourse] = useState(null);
    const [showAddCourse, setShowAddCourse] = useState(null);
    const [courseName, setCourseName] = useState('');
    const [courseCredits, setCourseCredits] = useState(3);
    const [showAddComponent, setShowAddComponent] = useState(null);
    const [customComponentName, setCustomComponentName] = useState('');
    const [entryModal, setEntryModal] = useState(null); // { semId, courseId, componentType, weight }
    const [entryScore, setEntryScore] = useState('');
    const [entryMaxScore, setEntryMaxScore] = useState('100');
    
    const semesters = state.grades?.semesters || [];
    const grading = state.grading || createInitialState().grading;
    const schemes = grading.schemes || [];
    const templates = grading.templates || [];
    const activeScheme = useMemo(() => schemes.find(s => s.id === grading.activeSchemeId) || schemes[0] || createInitialState().grading.schemes[0], [schemes, grading.activeSchemeId]);
    
    // --- UI state for new panels ---
    const [activeTab, setActiveTab] = useState('grades'); // grades | schemes | templates
    const [schemeModal, setSchemeModal] = useState(null); // null | scheme object for editing
    const [templateModal, setTemplateModal] = useState(null); // null | template object for editing
    const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id || '');
    const [whatIfCourse, setWhatIfCourse] = useState(null); // { semId, courseId }
    const [whatIfOverrides, setWhatIfOverrides] = useState({}); // { componentType: { score, maxScore } }
    
    const DEFAULT_COMPONENTS = [
        { type: 'Class Test', label: 'Class Tests', icon: '📝', multiple: true, maxEntries: 2 },
        { type: 'Assignment', label: 'Assignments', icon: '📋', multiple: true, maxEntries: 2 },
        { type: 'Mid Semester', label: 'Mid Semester', icon: '📖', multiple: false, maxEntries: 1 },
        { type: 'End Semester', label: 'End Semester', icon: '🎓', multiple: false, maxEntries: 1 },
        { type: 'Attendance', label: 'Attendance', icon: '📅', multiple: false, maxEntries: 1 },
    ];
    
    // --- Pure helper: percent → GPA using active scheme boundaries ---
    const percentToGpa = useCallback((pct, scheme) => {
        const boundaries = (scheme || activeScheme).boundaries || [];
        for (const b of boundaries) {
            if (pct >= b.minPercent) return { gpa: b.gpa, letter: b.letter, label: b.label };
        }
        const last = boundaries[boundaries.length - 1];
        return last ? { gpa: last.gpa, letter: last.letter, label: last.label } : { gpa: 0, letter: 'F', label: 'Fail' };
    }, [activeScheme]);
    
    // --- Pure helper: apply rounding ---
    const roundGpa = useCallback((value, scheme) => {
        const r = (scheme || activeScheme).rounding || { mode: 'fixed', decimals: 2 };
        const d = Math.pow(10, r.decimals || 2);
        if (r.mode === 'floor') return Math.floor(value * d) / d;
        if (r.mode === 'ceil') return Math.ceil(value * d) / d;
        return Math.round(value * d) / d; // 'fixed' or 'nearest'
    }, [activeScheme]);
    
    // --- Scheme-based getLetterGrade (replaces hardcoded) ---
    const getLetterGrade = useCallback((pct) => {
        const { letter, label } = percentToGpa(pct);
        const grade = letter || label || 'N/A';
        // Color based on percentage ranges
        let color = 'text-rose-400';
        if (pct >= 80) color = 'text-emerald-400';
        else if (pct >= 60) color = 'text-blue-400';
        else if (pct >= 40) color = 'text-amber-400';
        return { grade, color };
    }, [percentToGpa]);
    
    // Migrate old assessments to component-based structure for backward compat
    const getComponents = (course) => {
        const assessments = course.assessments || [];
        if (assessments.length === 0) return [];
        // Group assessments by type (component)
        const groups = {};
        assessments.forEach(a => {
            const type = a.type || 'Other';
            if (!groups[type]) groups[type] = { type, entries: [], weight: 0 };
            groups[type].entries.push(a);
            // Use the weight from any entry (they should all share the same component weight)
            if (a.componentWeight !== undefined) {
                groups[type].weight = a.componentWeight;
            } else {
                // Legacy: sum individual weights
                groups[type].weight += (a.weight || 0);
            }
        });
        return Object.values(groups);
    };
    
    const getTotalWeight = (course) => {
        const components = getComponents(course);
        return components.reduce((sum, comp) => sum + (comp.weight || 0), 0);
    };
    
    const calcCoursePercentage = (course) => {
        const components = getComponents(course);
        if (components.length === 0) return null;
        const totalWeight = components.reduce((s, comp) => s + comp.weight, 0);
        if (totalWeight === 0) return null;
        let weightedScore = 0;
        let hasAnyScore = false;
        components.forEach(comp => {
            const entries = comp.entries || [];
            const scored = entries.filter(e => e.score !== undefined && e.score !== null && e.maxScore > 0);
            if (scored.length > 0) {
                hasAnyScore = true;
                // Each entry gets equal share of the component weight
                const perEntryWeight = comp.weight / entries.length;
                scored.forEach(e => {
                    weightedScore += (e.score / e.maxScore) * perEntryWeight;
                });
            }
        });
        if (!hasAnyScore) return null;
        return weightedScore;
    };
    
    const calcCourseGPA = (course) => {
        const pct = calcCoursePercentage(course);
        if (pct === null) return null;
        return percentToGpa(pct).gpa;
    };
    
    const calcSemesterGPA = (semester) => {
        const courses = semester.courses || [];
        let totalCredits = 0, totalPoints = 0;
        courses.forEach(c => {
            const gpa = calcCourseGPA(c);
            if (gpa !== null) {
                totalCredits += c.creditHours || 3;
                totalPoints += gpa * (c.creditHours || 3);
            }
        });
        return totalCredits > 0 ? roundGpa(totalPoints / totalCredits).toFixed(2) : 'N/A';
    };
    
    const calcCGPA = () => {
        let totalCredits = 0, totalPoints = 0;
        semesters.forEach(sem => {
            (sem.courses || []).forEach(c => {
                const gpa = calcCourseGPA(c);
                if (gpa !== null) {
                    totalCredits += c.creditHours || 3;
                    totalPoints += gpa * (c.creditHours || 3);
                }
            });
        });
        return totalCredits > 0 ? roundGpa(totalPoints / totalCredits).toFixed(2) : 'N/A';
    };
    
    const handleAddSemester = () => {
        if (!semesterName.trim()) return;
        const newId = crypto.randomUUID();
        dispatch({ type: ActionTypes.ADD_SEMESTER, payload: { id: newId, name: semesterName.trim(), courses: [] } });
        setSemesterName(''); setShowAddSemester(false);
        setExpandedSemester(newId);
        showToast('Semester added', 'success');
    };
    
    const handleDeleteSemester = (semId) => {
        if (confirm('Delete this semester and all its courses?')) {
            dispatch({ type: ActionTypes.DELETE_SEMESTER, payload: semId });
            if (expandedSemester === semId) setExpandedSemester(null);
            showToast('Semester deleted', 'success');
        }
    };
    
    const handleAddCourse = (semId) => {
        if (!courseName.trim()) return;
        const newId = crypto.randomUUID();
        // Generate assessments from selected template
        let assessments = [];
        const tmpl = templates.find(t => t.id === selectedTemplateId);
        if (tmpl && tmpl.components) {
            assessments = tmpl.components.map(comp => ({
                id: crypto.randomUUID(),
                name: comp.name,
                type: comp.type,
                componentWeight: comp.weight,
                weight: comp.weight,
                score: null,
                maxScore: null,
            }));
        }
        dispatch({ type: ActionTypes.ADD_COURSE, payload: { semesterId: semId, course: { id: newId, name: courseName.trim(), creditHours: courseCredits, assessments } } });
        setCourseName(''); setCourseCredits(3); setShowAddCourse(null);
        setExpandedCourse(newId);
        showToast('Course added', 'success');
    };
    
    const handleDeleteCourse = (semId, courseId) => {
        if (confirm('Delete this course and all its components?')) {
            dispatch({ type: ActionTypes.DELETE_COURSE, payload: { semesterId: semId, courseId } });
            if (expandedCourse === courseId) setExpandedCourse(null);
            showToast('Course deleted', 'success');
        }
    };
    
    const handleAddComponentEntry = (semId, courseId, componentType, componentWeight) => {
        setEntryModal({ semId, courseId, componentType, weight: componentWeight });
        setEntryScore('');
        setEntryMaxScore('100');
    };
    
    const handleSubmitEntry = () => {
        if (!entryModal) return;
        const { semId, courseId, componentType, weight } = entryModal;
        const score = Number(entryScore);
        const maxScore = Number(entryMaxScore);
        if (isNaN(score) || score < 0 || isNaN(maxScore) || maxScore < 1) {
            showToast('Please enter valid marks', 'error');
            return;
        }
        const course = semesters.find(s => s.id === semId)?.courses?.find(c => c.id === courseId);
        if (!course) return;
        const existing = (course.assessments || []).filter(a => a.type === componentType);
        const entryNum = existing.length + 1;
        dispatch({
            type: ActionTypes.ADD_ASSESSMENT,
            payload: {
                semesterId: semId,
                courseId,
                assessment: {
                    id: crypto.randomUUID(),
                    name: `${componentType} ${entryNum}`,
                    type: componentType,
                    componentWeight: weight,
                    weight: weight,
                    score,
                    maxScore,
                }
            }
        });
        setEntryModal(null);
        showToast('Marks saved', 'success');
    };
    
    const handleAddCustomComponent = (semId, courseId) => {
        if (!customComponentName.trim()) return;
        const cName = customComponentName.trim();
        dispatch({
            type: ActionTypes.ADD_ASSESSMENT,
            payload: {
                semesterId: semId,
                courseId,
                assessment: {
                    id: crypto.randomUUID(),
                    name: `${cName} 1`,
                    type: cName,
                    componentWeight: 0,
                    weight: 0,
                    score: 0,
                    maxScore: 100,
                }
            }
        });
        setCustomComponentName('');
        setShowAddComponent(null);
        showToast('Custom component added', 'success');
    };
    
    const handleUpdateEntry = (semId, courseId, assessmentId, updates) => {
        dispatch({
            type: ActionTypes.UPDATE_ASSESSMENT,
            payload: { semesterId: semId, courseId, assessmentId, updates }
        });
    };
    
    const handleUpdateComponentWeight = (semId, courseId, componentType, newWeight) => {
        const course = semesters.find(s => s.id === semId)?.courses?.find(c => c.id === courseId);
        if (!course) return;
        (course.assessments || []).filter(a => a.type === componentType).forEach(a => {
            dispatch({
                type: ActionTypes.UPDATE_ASSESSMENT,
                payload: { semesterId: semId, courseId, assessmentId: a.id, updates: { componentWeight: newWeight, weight: newWeight } }
            });
        });
    };
    
    const handleDeleteEntry = (semId, courseId, assessmentId) => {
        dispatch({ type: ActionTypes.DELETE_ASSESSMENT, payload: { semesterId: semId, courseId, assessmentId } });
    };
    
    // Component for rendering a single course's component (e.g., Class Tests)
    const ComponentSection = ({ semId, courseId, componentType, entries, weight, totalWeightUsed, isCustom }) => {
        const info = DEFAULT_COMPONENTS.find(d => d.type === componentType);
        const icon = info?.icon || '📌';
        const label = info?.label || componentType;
        const maxEntries = info?.maxEntries || 5;
        const canAddMore = entries.length < maxEntries;
        
        return (
            <div className="bg-slate-800/60 rounded-lg p-3 space-y-2 border border-slate-700/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-sm">{icon}</span>
                        <span className="text-sm font-medium text-white">{label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                            <input
                                type="number"
                                value={weight}
                                onChange={e => {
                                    const val = Math.max(0, Math.min(100, Number(e.target.value)));
                                    handleUpdateComponentWeight(semId, courseId, componentType, val);
                                }}
                                className="w-14 px-1 py-0.5 bg-slate-700 rounded text-white text-xs text-center border border-slate-600"
                                min="0" max="100"
                            />
                            <span className="text-xs text-slate-400">%</span>
                        </div>
                    </div>
                </div>
                
                {/* Entry summary rows - clean display with delete */}
                {entries.length > 0 && (
                    <div className="space-y-1">
                        {entries.map(entry => {
                            const pctVal = entry.maxScore > 0 ? (entry.score / entry.maxScore) : 0;
                            const perEntryWeight = weight / entries.length;
                            const contributed = (pctVal * perEntryWeight).toFixed(1);
                            return (
                                <div key={entry.id} className="flex items-center justify-between py-1.5 px-2 bg-slate-900/40 rounded">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-slate-300 font-medium">{entry.name}</span>
                                        <span className="text-xs text-white">{entry.score}/{entry.maxScore}</span>
                                        <span className="text-xs text-indigo-400 font-medium">→ {contributed}/{perEntryWeight.toFixed(1)}</span>
                                    </div>
                                    <button onClick={() => handleDeleteEntry(semId, courseId, entry.id)} className="text-rose-400 hover:text-rose-300 text-xs p-1" aria-label="Delete entry">✕</button>
                                </div>
                            );
                        })}
                    </div>
                )}
                
                {canAddMore && (
                    <button
                        onClick={() => handleAddComponentEntry(semId, courseId, componentType, weight)}
                        className="w-full py-1.5 text-xs text-indigo-400 hover:bg-indigo-500/10 rounded border border-dashed border-slate-600"
                    >
                        + Add {componentType} Marks
                    </button>
                )}
            </div>
        );
    };
    
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-1">📈 Grade Tracker</h2>
                    <p className="text-slate-400 text-sm">Track courses, components & weighted grades</p>
                </div>
                <div className="text-right">
                    <div className="text-xs text-slate-400">CGPA (out of {activeScheme.scaleMax})</div>
                    <div className="text-2xl font-bold text-indigo-400">{calcCGPA()}</div>
                </div>
            </div>
            
            <button onClick={() => setShowAddSemester(true)} className="w-full py-3 bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-indigo-400 font-medium hover:bg-indigo-500/30 transition-colors">
                + Add Semester
            </button>
            
            {showAddSemester && (
                <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700 space-y-3">
                    <input type="text" value={semesterName} onChange={e => setSemesterName(e.target.value)} placeholder="Semester name (e.g., Fall 2026)"
                        className="w-full px-3 py-2 bg-slate-800 rounded-lg border border-slate-600 text-white text-sm"
                        onKeyDown={e => e.key === 'Enter' && handleAddSemester()} />
                    <div className="flex gap-2">
                        <button onClick={handleAddSemester} className="flex-1 py-2 bg-indigo-500 rounded-lg text-white text-sm font-medium">Add</button>
                        <button onClick={() => { setShowAddSemester(false); setSemesterName(''); }} className="flex-1 py-2 bg-slate-700 rounded-lg text-slate-300 text-sm">Cancel</button>
                    </div>
                </div>
            )}
            
            {semesters.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                    <div className="text-4xl mb-3">🎓</div>
                    <p className="font-medium text-white mb-1">No semesters yet</p>
                    <p className="text-sm">Add a semester to start tracking your grades</p>
                </div>
            ) : (
                semesters.map(sem => {
                    const isExpanded = expandedSemester === sem.id;
                    return (
                        <div key={sem.id} className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
                            <button
                                onClick={() => setExpandedSemester(isExpanded ? null : sem.id)}
                                className="w-full p-4 flex items-center justify-between hover:bg-slate-800/80 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-lg">{isExpanded ? '▼' : '▶'}</span>
                                    <div className="text-left">
                                        <h3 className="font-bold text-white">{sem.name}</h3>
                                        <span className="text-xs text-slate-400">{(sem.courses || []).length} course(s)</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm text-indigo-400 font-medium">GPA: {calcSemesterGPA(sem)}/{activeScheme.scaleMax}</span>
                                    <button onClick={e => { e.stopPropagation(); handleDeleteSemester(sem.id); }}
                                        className="text-rose-400 hover:text-rose-300 text-sm p-1" aria-label="Delete semester">🗑️</button>
                                </div>
                            </button>
                            
                            {isExpanded && (
                                <div className="p-4 pt-0 space-y-3">
                                    {(sem.courses || []).map(course => {
                                        const gpa = calcCourseGPA(course);
                                        const pct = calcCoursePercentage(course);
                                        const isOpen = expandedCourse === course.id;
                                        const components = getComponents(course);
                                        const totalWeight = getTotalWeight(course);
                                        const weightValid = totalWeight === 100;
                                        const weightOver = totalWeight > 100;
                                        const availableDefaults = DEFAULT_COMPONENTS.filter(d => {
                                            const comp = components.find(c => c.type === d.type);
                                            if (!comp) return true;
                                            return comp.entries.length < d.maxEntries;
                                        });
                                        
                                        return (
                                            <div key={course.id} className="bg-slate-900/50 rounded-xl border border-slate-700/50 overflow-hidden">
                                                <button
                                                    onClick={() => setExpandedCourse(isOpen ? null : course.id)}
                                                    className="w-full p-3 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm">{isOpen ? '▼' : '▶'}</span>
                                                        <span className="font-medium text-white text-sm">{course.name}</span>
                                                        <span className="text-xs text-slate-400">({course.creditHours} cr)</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        {pct !== null && (
                                                            <span className={`text-xs font-medium ${getLetterGrade(pct).color}`}>
                                                                {pct.toFixed(1)}% — {getLetterGrade(pct).grade}
                                                            </span>
                                                        )}
                                                        <button onClick={e => { e.stopPropagation(); handleDeleteCourse(sem.id, course.id); }}
                                                            className="text-rose-400 hover:text-rose-300 text-xs p-1" aria-label="Delete course">✕</button>
                                                    </div>
                                                </button>
                                                
                                                {isOpen && (
                                                    <div className="p-3 pt-0 space-y-3">
                                                        {/* Weightage bar */}
                                                        <div className="space-y-1">
                                                            <div className="flex items-center justify-between text-xs">
                                                                <span className={`font-medium ${weightValid ? 'text-emerald-400' : weightOver ? 'text-rose-400' : 'text-amber-400'}`}>
                                                                    Total Weightage: {totalWeight}%
                                                                </span>
                                                                <span className="text-slate-400">
                                                                    {weightValid ? '✅ Valid' : weightOver ? '⚠️ Over 100%' : `${100 - totalWeight}% remaining`}
                                                                </span>
                                                            </div>
                                                            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full transition-all ${weightValid ? 'bg-emerald-500' : weightOver ? 'bg-rose-500' : 'bg-amber-500'}`}
                                                                    style={{ width: `${Math.min(100, totalWeight)}%` }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Component sections */}
                                                        {components.map(comp => (
                                                            <ComponentSection
                                                                key={comp.type}
                                                                semId={sem.id}
                                                                courseId={course.id}
                                                                componentType={comp.type}
                                                                entries={comp.entries}
                                                                weight={comp.weight}
                                                                totalWeightUsed={totalWeight}
                                                            />
                                                        ))}
                                                        
                                                        {/* Contribution breakdown */}
                                                        {components.length > 0 && pct !== null && (() => {
                                                            const letterGrade = getLetterGrade(pct);
                                                            let totalContrib = 0;
                                                            return (
                                                                <div className="bg-slate-800/80 rounded-lg p-3 space-y-1.5">
                                                                    <div className="flex items-center justify-between mb-1">
                                                                        <div className="text-xs font-medium text-slate-300">Contribution Breakdown (out of 100)</div>
                                                                        <span className={`text-xs font-bold ${letterGrade.color}`}>{letterGrade.grade}</span>
                                                                    </div>
                                                                    {components.map(comp => {
                                                                        const scored = comp.entries.filter(e => e.score !== undefined && e.maxScore > 0);
                                                                        if (scored.length === 0) return null;
                                                                        return scored.map((entry, idx) => {
                                                                            const entryPct = entry.score / entry.maxScore;
                                                                            const perEntryWeight = comp.weight / comp.entries.length;
                                                                            const contrib = entryPct * perEntryWeight;
                                                                            totalContrib += contrib;
                                                                            return (
                                                                                <div key={entry.id} className="flex items-center justify-between text-xs">
                                                                                    <span className="text-slate-400">{entry.name} ({entry.score}/{entry.maxScore})</span>
                                                                                    <span className="text-white font-medium">{contrib.toFixed(1)} / {perEntryWeight.toFixed(1)}</span>
                                                                                </div>
                                                                            );
                                                                        });
                                                                    })}
                                                                    <div className="border-t border-slate-700 pt-1.5 mt-1">
                                                                        <div className="flex items-center justify-between text-sm font-bold">
                                                                            <span className="text-slate-300">Total</span>
                                                                            <span className={letterGrade.color}>{pct.toFixed(1)} / 100 — {letterGrade.grade}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}
                                                        
                                                        {/* Add component buttons */}
                                                        <div className="space-y-2">
                                                            {availableDefaults.length > 0 && (
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {availableDefaults.map(def => (
                                                                        <button
                                                                            key={def.type}
                                                                            onClick={() => handleAddComponentEntry(sem.id, course.id, def.type, 0)}
                                                                            className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-600 transition-colors"
                                                                        >
                                                                            {def.icon} + {def.label}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            
                                                            {showAddComponent === course.id ? (
                                                                <div className="flex gap-2 items-center">
                                                                    <input
                                                                        type="text"
                                                                        value={customComponentName}
                                                                        onChange={e => setCustomComponentName(e.target.value)}
                                                                        placeholder="Custom component name"
                                                                        className="flex-1 px-2 py-1 bg-slate-700 rounded text-white text-xs border border-slate-600"
                                                                        onKeyDown={e => e.key === 'Enter' && handleAddCustomComponent(sem.id, course.id)}
                                                                    />
                                                                    <button onClick={() => handleAddCustomComponent(sem.id, course.id)} className="px-2 py-1 bg-indigo-500 rounded text-white text-xs">Add</button>
                                                                    <button onClick={() => { setShowAddComponent(null); setCustomComponentName(''); }} className="px-2 py-1 bg-slate-700 rounded text-slate-300 text-xs">Cancel</button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => setShowAddComponent(course.id)}
                                                                    className="w-full py-1.5 text-xs text-indigo-400 hover:bg-indigo-500/10 rounded border border-dashed border-slate-600"
                                                                >
                                                                    + Add Custom Component
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    
                                    {/* Add Course */}
                                    {showAddCourse === sem.id ? (
                                        <div className="space-y-2 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                                            <input type="text" value={courseName} onChange={e => setCourseName(e.target.value)} placeholder="Course name"
                                                className="w-full px-2 py-1.5 bg-slate-800 rounded text-white text-sm border border-slate-600"
                                                onKeyDown={e => e.key === 'Enter' && handleAddCourse(sem.id)} />
                                            <div className="flex items-center gap-2">
                                                <label className="text-xs text-slate-400">Credits:</label>
                                                <input type="number" value={courseCredits} onChange={e => setCourseCredits(Math.max(1, Math.min(10, Number(e.target.value))))}
                                                    min="1" max="10" className="w-16 px-2 py-1 bg-slate-800 rounded text-white text-xs border border-slate-600" />
                                            </div>
                                            {templates.length > 0 && (
                                                <div className="flex items-center gap-2">
                                                    <label className="text-xs text-slate-400">Template:</label>
                                                    <select value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)}
                                                        className="flex-1 px-2 py-1 bg-slate-800 rounded text-white text-xs border border-slate-600">
                                                        <option value="">None (empty course)</option>
                                                        {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                                    </select>
                                                </div>
                                            )}
                                            <div className="flex gap-2">
                                                <button onClick={() => handleAddCourse(sem.id)} className="flex-1 py-1.5 bg-indigo-500 rounded text-white text-sm font-medium">Add Course</button>
                                                <button onClick={() => { setShowAddCourse(null); setCourseName(''); }} className="flex-1 py-1.5 bg-slate-700 rounded text-slate-300 text-sm">Cancel</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button onClick={() => setShowAddCourse(sem.id)} className="w-full py-2 text-indigo-400 text-sm hover:bg-indigo-500/10 rounded-lg border border-dashed border-slate-700">
                                            + Add Course
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })
            )}
            
            {/* Entry Marks Modal */}
            {entryModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setEntryModal(null)}>
                    <div className="w-full max-w-sm mx-4 bg-slate-900 rounded-2xl p-6 border border-slate-700" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-white mb-1">Enter Marks</h3>
                        <p className="text-sm text-slate-400 mb-4">{entryModal.componentType}</p>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Marks Obtained</label>
                                <input
                                    type="number"
                                    value={entryScore}
                                    onChange={e => setEntryScore(e.target.value)}
                                    placeholder="e.g. 35"
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-lg"
                                    min="0"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Maximum Marks</label>
                                <input
                                    type="number"
                                    value={entryMaxScore}
                                    onChange={e => setEntryMaxScore(e.target.value)}
                                    placeholder="e.g. 50"
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-lg"
                                    min="1"
                                />
                            </div>
                            {entryScore !== '' && entryMaxScore !== '' && Number(entryMaxScore) > 0 && (
                                <div className="text-center py-2 bg-slate-800/50 rounded-lg">
                                    <span className="text-2xl font-bold text-indigo-400">{((Number(entryScore) / Number(entryMaxScore)) * 100).toFixed(1)}%</span>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setEntryModal(null)}
                                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-white font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmitEntry}
                                className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 rounded-xl text-white font-medium transition-colors"
                            >
                                Save Marks
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* ===== Grading Scheme Manager ===== */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white">⚙️ Grading Schemes</h3>
                    <button onClick={() => setSchemeModal({ id: '', name: '', scaleMax: 10, rounding: { mode: 'fixed', decimals: 2 }, boundaries: [{ minPercent: 90, gpa: 10, letter: 'O', label: 'Excellent' }, { minPercent: 80, gpa: 9, letter: 'A+', label: 'Very Good' }, { minPercent: 70, gpa: 8, letter: 'A', label: 'Good' }, { minPercent: 60, gpa: 7, letter: 'B+', label: 'Above Avg' }, { minPercent: 50, gpa: 6, letter: 'B', label: 'Avg' }, { minPercent: 40, gpa: 5, letter: 'C', label: 'Pass' }, { minPercent: 0, gpa: 0, letter: 'F', label: 'Fail' }] })}
                        className="text-xs px-2 py-1 bg-indigo-500/20 text-indigo-400 rounded-lg hover:bg-indigo-500/30">+ Add Scheme</button>
                </div>
                <div className="space-y-1.5">
                    {schemes.map(s => (
                        <div key={s.id} className={`flex items-center justify-between p-2 rounded-lg border ${s.id === grading.activeSchemeId ? 'border-indigo-500/50 bg-indigo-500/10' : 'border-slate-700 bg-slate-900/40'}`}>
                            <div>
                                <span className="text-xs text-white font-medium">{s.name}</span>
                                <span className="text-[10px] text-slate-400 ml-1">({s.boundaries?.length || 0} levels, max {s.scaleMax})</span>
                            </div>
                            <div className="flex items-center gap-1">
                                {s.id !== grading.activeSchemeId && (
                                    <button onClick={() => dispatch({ type: ActionTypes.SET_ACTIVE_GRADING_SCHEME, payload: s.id })}
                                        className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30">Set Active</button>
                                )}
                                {s.id === grading.activeSchemeId && <span className="text-[10px] px-1.5 py-0.5 bg-indigo-500/30 text-indigo-300 rounded">Active</span>}
                                <button onClick={() => setSchemeModal({...s})} className="text-slate-400 hover:text-white text-xs p-0.5" aria-label="Edit scheme">✏️</button>
                                <button onClick={() => { dispatch({ type: ActionTypes.ADD_GRADING_SCHEME, payload: { ...s, id: crypto.randomUUID(), name: s.name + ' (copy)', boundaries: s.boundaries.map(b => ({...b})) } }); showToast('Scheme duplicated', 'success'); }}
                                    className="text-slate-400 hover:text-white text-xs p-0.5" aria-label="Duplicate scheme">📋</button>
                                {s.id !== grading.activeSchemeId && (
                                    <button onClick={() => { dispatch({ type: ActionTypes.DELETE_GRADING_SCHEME, payload: s.id }); showToast('Scheme deleted', 'success'); }}
                                        className="text-rose-400 hover:text-rose-300 text-xs p-0.5" aria-label="Delete scheme">✕</button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            
            {/* ===== Assessment Template Manager ===== */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white">📄 Assessment Templates</h3>
                    <button onClick={() => setTemplateModal({ id: '', name: '', components: [{ key: crypto.randomUUID(), name: 'Component 1', type: 'Custom', weight: 100 }] })}
                        className="text-xs px-2 py-1 bg-indigo-500/20 text-indigo-400 rounded-lg hover:bg-indigo-500/30">+ Add Template</button>
                </div>
                <div className="space-y-1.5">
                    {templates.map(t => {
                        const totalW = (t.components || []).reduce((s, c) => s + (c.weight || 0), 0);
                        return (
                            <div key={t.id} className="flex items-center justify-between p-2 rounded-lg border border-slate-700 bg-slate-900/40">
                                <div>
                                    <span className="text-xs text-white font-medium">{t.name}</span>
                                    <span className="text-[10px] text-slate-400 ml-1">({(t.components || []).length} comps, {totalW}%{totalW !== 100 ? ' ⚠️' : ''})</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setTemplateModal({...t, components: (t.components || []).map(c => ({...c}))})} className="text-slate-400 hover:text-white text-xs p-0.5" aria-label="Edit template">✏️</button>
                                    <button onClick={() => { dispatch({ type: ActionTypes.ADD_GRADE_TEMPLATE, payload: { ...t, id: crypto.randomUUID(), name: t.name + ' (copy)', components: (t.components || []).map(c => ({...c, key: crypto.randomUUID()})) } }); showToast('Template duplicated', 'success'); }}
                                        className="text-slate-400 hover:text-white text-xs p-0.5" aria-label="Duplicate template">📋</button>
                                    <button onClick={() => { dispatch({ type: ActionTypes.DELETE_GRADE_TEMPLATE, payload: t.id }); showToast('Template deleted', 'success'); }}
                                        className="text-rose-400 hover:text-rose-300 text-xs p-0.5" aria-label="Delete template">✕</button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            
            {/* ===== Scheme Editor Modal ===== */}
            {schemeModal && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSchemeModal(null)}>
                    <div className="w-full max-w-lg mx-4 bg-slate-900 rounded-t-2xl sm:rounded-2xl p-5 border border-slate-700 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-white mb-3">{schemeModal.id ? 'Edit Scheme' : 'New Scheme'}</h3>
                        <div className="space-y-3">
                            <div className="flex gap-2">
                                <input type="text" value={schemeModal.name} onChange={e => setSchemeModal({...schemeModal, name: e.target.value})} placeholder="Scheme name"
                                    className="flex-1 px-3 py-2 bg-slate-800 rounded-lg border border-slate-600 text-white text-sm" />
                                <input type="number" value={schemeModal.scaleMax} onChange={e => setSchemeModal({...schemeModal, scaleMax: Math.max(1, Number(e.target.value))})}
                                    className="w-20 px-2 py-2 bg-slate-800 rounded-lg border border-slate-600 text-white text-sm text-center" min="1" />
                                <span className="text-xs text-slate-400 self-center">max</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-xs text-slate-400">Rounding:</label>
                                <select value={schemeModal.rounding?.mode || 'fixed'} onChange={e => setSchemeModal({...schemeModal, rounding: {...(schemeModal.rounding || {}), mode: e.target.value}})}
                                    className="px-2 py-1 bg-slate-800 rounded border border-slate-600 text-white text-xs">
                                    <option value="fixed">Fixed</option><option value="floor">Floor</option><option value="ceil">Ceil</option><option value="nearest">Nearest</option>
                                </select>
                                <input type="number" value={schemeModal.rounding?.decimals ?? 2} onChange={e => setSchemeModal({...schemeModal, rounding: {...(schemeModal.rounding || {}), decimals: Math.max(0, Math.min(4, Number(e.target.value)))}})}
                                    className="w-14 px-2 py-1 bg-slate-800 rounded border border-slate-600 text-white text-xs text-center" min="0" max="4" />
                                <span className="text-xs text-slate-400">decimals</span>
                            </div>
                            <div className="text-xs font-medium text-slate-300">Boundaries (min % → GPA)</div>
                            <div className="space-y-1">
                                {(schemeModal.boundaries || []).map((b, idx) => (
                                    <div key={idx} className="flex items-center gap-1">
                                        <input type="number" value={b.minPercent} onChange={e => { const bs = [...schemeModal.boundaries]; bs[idx] = {...bs[idx], minPercent: Number(e.target.value)}; setSchemeModal({...schemeModal, boundaries: bs}); }}
                                            className="w-14 px-1 py-1 bg-slate-800 rounded border border-slate-600 text-white text-xs text-center" min="0" max="100" />
                                        <span className="text-xs text-slate-400">→</span>
                                        <input type="number" value={b.gpa} onChange={e => { const bs = [...schemeModal.boundaries]; bs[idx] = {...bs[idx], gpa: Number(e.target.value)}; setSchemeModal({...schemeModal, boundaries: bs}); }}
                                            className="w-12 px-1 py-1 bg-slate-800 rounded border border-slate-600 text-white text-xs text-center" min="0" step="0.5" />
                                        <input type="text" value={b.letter || ''} onChange={e => { const bs = [...schemeModal.boundaries]; bs[idx] = {...bs[idx], letter: e.target.value}; setSchemeModal({...schemeModal, boundaries: bs}); }}
                                            className="w-12 px-1 py-1 bg-slate-800 rounded border border-slate-600 text-white text-xs text-center" placeholder="Ltr" />
                                        <input type="text" value={b.label || ''} onChange={e => { const bs = [...schemeModal.boundaries]; bs[idx] = {...bs[idx], label: e.target.value}; setSchemeModal({...schemeModal, boundaries: bs}); }}
                                            className="flex-1 px-1 py-1 bg-slate-800 rounded border border-slate-600 text-white text-xs" placeholder="Label" />
                                        <button onClick={() => { const bs = schemeModal.boundaries.filter((_, i) => i !== idx); setSchemeModal({...schemeModal, boundaries: bs}); }}
                                            className="text-rose-400 text-xs p-0.5">✕</button>
                                    </div>
                                ))}
                                <button onClick={() => setSchemeModal({...schemeModal, boundaries: [...(schemeModal.boundaries || []), { minPercent: 0, gpa: 0, letter: '', label: '' }]})}
                                    className="w-full py-1 text-xs text-indigo-400 hover:bg-indigo-500/10 rounded border border-dashed border-slate-600">+ Add Boundary</button>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                            <button onClick={() => setSchemeModal(null)} className="flex-1 py-2 bg-slate-800 rounded-lg text-white text-sm">Cancel</button>
                            <button onClick={() => {
                                if (!schemeModal.name.trim()) { showToast('Name required', 'error'); return; }
                                const sorted = [...(schemeModal.boundaries || [])].sort((a, b) => b.minPercent - a.minPercent);
                                const scheme = { ...schemeModal, boundaries: sorted, id: schemeModal.id || crypto.randomUUID() };
                                if (schemes.find(s => s.id === scheme.id)) dispatch({ type: ActionTypes.UPDATE_GRADING_SCHEME, payload: scheme });
                                else dispatch({ type: ActionTypes.ADD_GRADING_SCHEME, payload: scheme });
                                setSchemeModal(null); showToast('Scheme saved', 'success');
                            }} className="flex-1 py-2 bg-indigo-500 rounded-lg text-white text-sm font-medium">Save</button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* ===== Template Editor Modal ===== */}
            {templateModal && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setTemplateModal(null)}>
                    <div className="w-full max-w-lg mx-4 bg-slate-900 rounded-t-2xl sm:rounded-2xl p-5 border border-slate-700 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-white mb-3">{templateModal.id ? 'Edit Template' : 'New Template'}</h3>
                        <div className="space-y-3">
                            <input type="text" value={templateModal.name} onChange={e => setTemplateModal({...templateModal, name: e.target.value})} placeholder="Template name"
                                className="w-full px-3 py-2 bg-slate-800 rounded-lg border border-slate-600 text-white text-sm" />
                            <div className="text-xs font-medium text-slate-300">Components</div>
                            {(() => {
                                const totalW = (templateModal.components || []).reduce((s, c) => s + (c.weight || 0), 0);
                                return (
                                    <div className="space-y-1">
                                        {(templateModal.components || []).map((comp, idx) => (
                                            <div key={comp.key || idx} className="flex items-center gap-1">
                                                <input type="text" value={comp.name} onChange={e => { const cs = [...templateModal.components]; cs[idx] = {...cs[idx], name: e.target.value}; setTemplateModal({...templateModal, components: cs}); }}
                                                    className="flex-1 px-2 py-1 bg-slate-800 rounded border border-slate-600 text-white text-xs" placeholder="Name" />
                                                <input type="text" value={comp.type} onChange={e => { const cs = [...templateModal.components]; cs[idx] = {...cs[idx], type: e.target.value}; setTemplateModal({...templateModal, components: cs}); }}
                                                    className="w-24 px-2 py-1 bg-slate-800 rounded border border-slate-600 text-white text-xs" placeholder="Type" />
                                                <input type="number" value={comp.weight} onChange={e => { const cs = [...templateModal.components]; cs[idx] = {...cs[idx], weight: Number(e.target.value)}; setTemplateModal({...templateModal, components: cs}); }}
                                                    className="w-14 px-1 py-1 bg-slate-800 rounded border border-slate-600 text-white text-xs text-center" min="0" max="100" />
                                                <button onClick={() => { const cs = templateModal.components.filter((_, i) => i !== idx); setTemplateModal({...templateModal, components: cs}); }}
                                                    className="text-rose-400 text-xs p-0.5">✕</button>
                                            </div>
                                        ))}
                                        <div className="flex items-center justify-between text-xs">
                                            <button onClick={() => setTemplateModal({...templateModal, components: [...(templateModal.components || []), { key: crypto.randomUUID(), name: '', type: 'Custom', weight: 0 }]})}
                                                className="py-1 px-2 text-indigo-400 hover:bg-indigo-500/10 rounded border border-dashed border-slate-600">+ Add Component</button>
                                            <span className={totalW === 100 ? 'text-emerald-400' : 'text-amber-400'}>Total: {totalW}% {totalW !== 100 ? '⚠️' : '✅'}</span>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                        <div className="flex gap-2 mt-4">
                            <button onClick={() => setTemplateModal(null)} className="flex-1 py-2 bg-slate-800 rounded-lg text-white text-sm">Cancel</button>
                            <button onClick={() => {
                                if (!templateModal.name.trim()) { showToast('Name required', 'error'); return; }
                                const tmpl = { ...templateModal, id: templateModal.id || crypto.randomUUID() };
                                if (templates.find(t => t.id === tmpl.id)) dispatch({ type: ActionTypes.UPDATE_GRADE_TEMPLATE, payload: tmpl });
                                else dispatch({ type: ActionTypes.ADD_GRADE_TEMPLATE, payload: tmpl });
                                setTemplateModal(null); showToast('Template saved', 'success');
                            }} className="flex-1 py-2 bg-indigo-500 rounded-lg text-white text-sm font-medium">Save</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

// ============================================================================
// SECTION 8D: CALENDAR VIEW
// ============================================================================

export const CalendarView = memo(() => {
    const { state, dispatch } = useApp();
    const [calMode, setCalMode] = useState('month'); // month | week | agenda
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDateKey, setSelectedDateKey] = useState(null);
    const [agendaRange, setAgendaRange] = useState(30);

    const weekStartsOn = state.settings?.weekStartsOn ?? 0;
    const timeFormat = state.settings?.timeFormat || '12h';
    const todayKey = DateUtils.toKey();

    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const dayNamesBase = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const dayNamesFull = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const dayNames = useMemo(() => {
        if (weekStartsOn === 0) return dayNamesBase;
        return [...dayNamesBase.slice(weekStartsOn), ...dayNamesBase.slice(0, weekStartsOn)];
    }, [weekStartsOn]);

    // --- Helper: format time ---
    const formatTime = useCallback((timeStr) => {
        if (!timeStr) return '';
        const [h, m] = timeStr.split(':').map(Number);
        if (timeFormat === '24h') return timeStr;
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
    }, [timeFormat]);

    // --- Helper: get subject color ---
    const getSubjectColor = useCallback((subjectName) => {
        const subj = (state.subjects || []).find(s => (typeof s === 'string' ? s : s.name) === subjectName);
        if (subj && typeof subj === 'object' && subj.color) {
            return CONFIG.COLORS[subj.color]?.bg || '#6366f1';
        }
        return '#6366f1';
    }, [state.subjects]);

    // --- Goal category colors ---
    const goalCategoryColors = { Academic: '#8b5cf6', Health: '#10b981', Financial: '#f59e0b', Personal: '#06b6d4', Career: '#f43f5e' };

    // --- Unified event builder (derived, never persisted) ---
    const buildCalendarEvents = useCallback((startDate, endDate) => {
        const events = [];
        const startKey = DateUtils.toKey(startDate);
        const endKey = DateUtils.toKey(endDate);

        // Assignments & Exams
        (state.assignments || []).forEach(a => {
            if (!a.dueDate) return;
            const dueKey = a.dueDate.substring(0, 10);
            if (dueKey < startKey || dueKey > endKey) return;
            const isExam = a.type === 'exam';
            const hasTime = a.dueDate.length > 10;
            events.push({
                id: a.id,
                kind: isExam ? 'exam' : 'assignment',
                title: `${isExam ? 'Exam' : 'Assignment'}: ${a.subject ? a.subject + ' — ' : ''}${a.title}`,
                start: a.dueDate,
                end: a.dueDate,
                allDay: !hasTime,
                color: isExam ? '#f43f5e' : getSubjectColor(a.subject),
                icon: isExam ? '🎓' : '📝',
                sourceId: a.id,
                meta: { status: a.status, priority: a.priority }
            });
        });

        // Timetable (recurring weekly — expand for visible range)
        const dayMap = dayNamesFull;
        let d = new Date(startDate);
        d.setHours(0, 0, 0, 0);
        const endD = new Date(endDate);
        endD.setHours(23, 59, 59, 999);
        while (d <= endD) {
            const dow = d.getDay();
            const dateKey = DateUtils.toKey(d);
            (state.timetable || []).forEach(t => {
                if ((t.days || [t.day]).includes(dayMap[dow])) {
                    events.push({
                        id: `tt-${t.id}-${dateKey}`,
                        kind: 'timetable',
                        title: t.subject + (t.room ? ` (${t.room})` : ''),
                        start: `${dateKey}T${t.startTime || '08:00'}`,
                        end: `${dateKey}T${t.endTime || '09:00'}`,
                        allDay: false,
                        color: t.color ? (CONFIG.COLORS[t.color]?.bg || getSubjectColor(t.subject)) : getSubjectColor(t.subject),
                        icon: '📚',
                        sourceId: t.id,
                        location: t.room,
                        meta: { startTime: t.startTime, endTime: t.endTime }
                    });
                }
            });
            d = DateUtils.addDays(d, 1);
        }

        // Goals
        (state.goals || []).forEach(g => {
            const deadline = g.deadline || g.targetDate;
            if (!deadline) return;
            const gKey = deadline.substring(0, 10);
            if (gKey < startKey || gKey > endKey) return;
            events.push({
                id: g.id,
                kind: 'goal',
                title: `Goal deadline: ${g.title}`,
                start: deadline,
                end: deadline,
                allDay: true,
                color: goalCategoryColors[g.category] || '#8b5cf6',
                icon: '🎯',
                sourceId: g.id,
                meta: { category: g.category }
            });
        });

        events.sort((a, b) => a.start.localeCompare(b.start));
        return events;
    }, [state.assignments, state.timetable, state.goals, state.subjects, getSubjectColor]);

    // --- Visible date range per mode ---
    const visibleRange = useMemo(() => {
        const y = currentDate.getFullYear();
        const m = currentDate.getMonth();
        if (calMode === 'month') {
            const first = new Date(y, m, 1);
            const last = new Date(y, m + 1, 0);
            return { start: first, end: last };
        }
        if (calMode === 'week') {
            const ws = DateUtils.startOfWeek(currentDate, weekStartsOn);
            return { start: ws, end: DateUtils.addDays(ws, 6) };
        }
        // agenda
        return { start: new Date(), end: DateUtils.addDays(new Date(), agendaRange) };
    }, [calMode, currentDate, weekStartsOn, agendaRange]);

    // --- All events for the visible range (memoized) ---
    const calendarEvents = useMemo(() => buildCalendarEvents(visibleRange.start, visibleRange.end), [buildCalendarEvents, visibleRange]);

    // --- Events indexed by dateKey (memoized) ---
    const eventsByDate = useMemo(() => {
        const map = {};
        calendarEvents.forEach(ev => {
            const key = ev.start.substring(0, 10);
            (map[key] = map[key] || []).push(ev);
        });
        return map;
    }, [calendarEvents]);

    // --- Navigation ---
    const goToday = () => setCurrentDate(new Date());
    const goPrev = () => {
        if (calMode === 'month') {
            setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
        } else if (calMode === 'week') {
            setCurrentDate(prev => DateUtils.addDays(prev, -7));
        }
    };
    const goNext = () => {
        if (calMode === 'month') {
            setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
        } else if (calMode === 'week') {
            setCurrentDate(prev => DateUtils.addDays(prev, 7));
        }
    };

    // --- "Open" action: navigate to source module ---
    const handleOpenEvent = (ev) => {
        setSelectedDateKey(null);
        if (ev.kind === 'assignment' || ev.kind === 'exam') {
            dispatch({ type: ActionTypes.SET_VIEW, payload: 'study' });
        } else if (ev.kind === 'timetable') {
            dispatch({ type: ActionTypes.SET_VIEW, payload: 'study' });
        } else if (ev.kind === 'goal') {
            dispatch({ type: ActionTypes.SET_VIEW, payload: 'goals' });
        }
    };

    // --- Header label ---
    const headerLabel = useMemo(() => {
        const y = currentDate.getFullYear();
        const m = currentDate.getMonth();
        if (calMode === 'month') return `${monthNames[m]} ${y}`;
        if (calMode === 'week') {
            const ws = DateUtils.startOfWeek(currentDate, weekStartsOn);
            const we = DateUtils.addDays(ws, 6);
            return `${DateUtils.format(ws, { month: 'short', day: 'numeric' })} – ${DateUtils.format(we, { month: 'short', day: 'numeric', year: 'numeric' })}`;
        }
        return 'Agenda';
    }, [calMode, currentDate, weekStartsOn]);

    // --- MONTH VIEW ---
    const renderMonth = () => {
        const y = currentDate.getFullYear();
        const m = currentDate.getMonth();
        const daysInMonth = DateUtils.daysInMonth(y, m);
        const firstDow = new Date(y, m, 1).getDay();
        const offset = (firstDow - weekStartsOn + 7) % 7;
        const cells = [];
        for (let i = 0; i < offset; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(d);

        return (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-3">
                <div className="grid grid-cols-7 gap-1 mb-2">
                    {dayNames.map(d => (
                        <div key={d} className="text-center text-xs text-slate-400 font-medium py-1">{d}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {cells.map((day, idx) => {
                        if (!day) return <div key={`empty-${idx}`} />;
                        const dateKey = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const dayEvents = eventsByDate[dateKey] || [];
                        const isToday = dateKey === todayKey;
                        return (
                            <button key={day} onClick={() => setSelectedDateKey(dateKey)}
                                aria-label={`${monthNames[m]} ${day}${dayEvents.length ? `, ${dayEvents.length} events` : ''}`}
                                className={`relative p-1.5 rounded-lg text-center text-sm transition-all min-h-[3rem] ${
                                    isToday ? 'bg-indigo-500/20 text-indigo-400 font-bold ring-1 ring-indigo-500/40' :
                                    'text-slate-300 hover:bg-slate-700'
                                }`}>
                                <div>{day}</div>
                                {dayEvents.length > 0 && (
                                    <div className="mt-0.5 space-y-0.5">
                                        {dayEvents.slice(0, 3).map((ev, i) => (
                                            <div key={i} className="text-[10px] leading-tight truncate rounded px-0.5" style={{ backgroundColor: ev.color + '33', color: ev.color }}>
                                                {ev.icon} {ev.title.length > 12 ? ev.title.substring(0, 12) + '…' : ev.title}
                                            </div>
                                        ))}
                                        {dayEvents.length > 3 && (
                                            <div className="text-[9px] text-slate-400">+{dayEvents.length - 3} more</div>
                                        )}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    // --- WEEK VIEW ---
    const renderWeek = () => {
        const ws = DateUtils.startOfWeek(currentDate, weekStartsOn);
        const days = Array.from({ length: 7 }, (_, i) => DateUtils.addDays(ws, i));
        return (
            <div className="space-y-2">
                {days.map(d => {
                    const dateKey = DateUtils.toKey(d);
                    const dayEvents = eventsByDate[dateKey] || [];
                    const isToday = dateKey === todayKey;
                    return (
                        <div key={dateKey}
                            className={`bg-slate-800/50 rounded-xl border p-3 cursor-pointer transition-all hover:bg-slate-800 ${isToday ? 'border-indigo-500/50' : 'border-slate-700'}`}
                            onClick={() => setSelectedDateKey(dateKey)}
                            role="button" tabIndex={0} aria-label={`${DateUtils.format(d, { weekday: 'long', month: 'short', day: 'numeric' })}${dayEvents.length ? `, ${dayEvents.length} events` : ''}`}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedDateKey(dateKey); } }}>
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${isToday ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-300'}`}>
                                    {DateUtils.format(d, { weekday: 'short', month: 'short', day: 'numeric' })}
                                </span>
                                {dayEvents.length > 0 && <span className="text-xs text-slate-400">{dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}</span>}
                            </div>
                            {dayEvents.length === 0 && <p className="text-xs text-slate-500">No events</p>}
                            <div className="space-y-1">
                                {dayEvents.map((ev, i) => (
                                    <div key={i} className="flex items-center gap-2 p-1.5 rounded-lg" style={{ backgroundColor: ev.color + '1a' }}>
                                        <div className="w-1 h-6 rounded-full" style={{ backgroundColor: ev.color }} />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-medium text-white truncate">{ev.icon} {ev.title}</div>
                                            {!ev.allDay && <div className="text-[10px] text-slate-400">{formatTime(ev.meta?.startTime)} – {formatTime(ev.meta?.endTime)}</div>}
                                        </div>
                                        {ev.location && <span className="text-[10px] text-slate-400">📍 {ev.location}</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    // --- AGENDA VIEW ---
    const renderAgenda = () => {
        const grouped = {};
        calendarEvents.forEach(ev => {
            const key = ev.start.substring(0, 10);
            (grouped[key] = grouped[key] || []).push(ev);
        });
        const sortedDates = Object.keys(grouped).sort();
        return (
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-400" htmlFor="agenda-range">Show next</label>
                    <select id="agenda-range" value={agendaRange} onChange={e => setAgendaRange(Number(e.target.value))}
                        className="bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-xs text-white">
                        <option value={7}>7 days</option>
                        <option value={30}>30 days</option>
                        <option value={90}>90 days</option>
                    </select>
                </div>
                {sortedDates.length === 0 && (
                    <div className="text-center py-8 text-slate-400">
                        <div className="text-3xl mb-2">📭</div>
                        <p className="text-sm">No upcoming events in the next {agendaRange} days</p>
                    </div>
                )}
                {sortedDates.map(dateKey => (
                    <div key={dateKey} className="bg-slate-800/50 rounded-xl border border-slate-700 p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${dateKey === todayKey ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-300'}`}>
                                {DateUtils.format(DateUtils.parseKey(dateKey), { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                        </div>
                        <div className="space-y-1">
                            {grouped[dateKey].map((ev, i) => (
                                <div key={i} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-700/50 transition-colors" style={{ backgroundColor: ev.color + '0d' }}>
                                    <div className="w-1.5 h-8 rounded-full" style={{ backgroundColor: ev.color }} />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-white truncate">{ev.icon} {ev.title}</div>
                                        <div className="text-[10px] text-slate-400">
                                            {ev.allDay ? 'All day' : `${formatTime(ev.meta?.startTime)} – ${formatTime(ev.meta?.endTime)}`}
                                            {ev.location ? ` · 📍 ${ev.location}` : ''}
                                        </div>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); handleOpenEvent(ev); }}
                                        className="text-xs px-2 py-1 bg-indigo-500/20 text-indigo-400 rounded-lg hover:bg-indigo-500/30 transition-colors"
                                        aria-label={`Open ${ev.title}`}>
                                        Open
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    // --- Day detail bottom-sheet modal ---
    const renderDayModal = () => {
        if (!selectedDateKey) return null;
        const dayEvents = eventsByDate[selectedDateKey] || [];
        const dateObj = DateUtils.parseKey(selectedDateKey);
        return (
            <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setSelectedDateKey(null)} role="dialog" aria-modal="true" aria-label="Day events">
                <div className="absolute inset-0 bg-black/60" />
                <div className="relative w-full max-w-lg bg-slate-900 rounded-t-2xl border-t border-slate-700 p-4 pb-8 max-h-[70vh] overflow-y-auto animate-slide-up"
                    tabIndex={-1} ref={el => el && el.focus()}
                    onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape') setSelectedDateKey(null); }}>
                    <div className="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-3" />
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-white text-lg">
                            {DateUtils.format(dateObj, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        </h3>
                        <button onClick={() => setSelectedDateKey(null)} className="text-slate-400 hover:text-white p-1" aria-label="Close day details">✕</button>
                    </div>
                    {dayEvents.length === 0 ? (
                        <div className="text-center py-6">
                            <div className="text-2xl mb-2">📭</div>
                            <p className="text-slate-400 text-sm">No events on this day</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {dayEvents.map((ev, idx) => (
                                <div key={idx} className="flex items-center gap-3 p-3 rounded-xl border border-slate-700/50 transition-colors" style={{ backgroundColor: ev.color + '0d' }}>
                                    <div className="w-1.5 self-stretch rounded-full" style={{ backgroundColor: ev.color }} />
                                    <div className="text-xl">{ev.icon}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-white truncate">{ev.title}</div>
                                        <div className="text-xs text-slate-400">
                                            {ev.allDay ? 'All day' : `${formatTime(ev.meta?.startTime)} – ${formatTime(ev.meta?.endTime)}`}
                                            {ev.location ? ` · 📍 ${ev.location}` : ''}
                                        </div>
                                        <div className="text-[10px] text-slate-500 capitalize mt-0.5">{ev.kind}</div>
                                    </div>
                                    <button onClick={() => handleOpenEvent(ev)}
                                        className="text-xs px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors whitespace-nowrap"
                                        aria-label={`Open ${ev.title} in ${ev.kind} view`}>
                                        Open
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-2xl font-bold text-white mb-1">📅 Calendar</h2>
                <p className="text-slate-400 text-sm">View all your events in one place</p>
            </div>

            {/* Mode Toggle */}
            <div className="flex gap-1 bg-slate-800/50 p-1 rounded-xl">
                {[
                    { id: 'month', label: 'Month', icon: '📆' },
                    { id: 'week', label: 'Week', icon: '📋' },
                    { id: 'agenda', label: 'Agenda', icon: '📃' }
                ].map(m => (
                    <button key={m.id} onClick={() => setCalMode(m.id)}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                            calMode === m.id ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                        aria-label={`${m.label} view`} aria-pressed={calMode === m.id}>
                        <span className="mr-1">{m.icon}</span>{m.label}
                    </button>
                ))}
            </div>

            {/* Calendar Header */}
            {calMode !== 'agenda' && (
                <div className="flex items-center justify-between bg-slate-800/50 rounded-xl p-3 border border-slate-700">
                    <button onClick={goPrev} className="px-3 py-1 text-slate-400 hover:text-white transition-colors" aria-label={`Previous ${calMode}`}>◀</button>
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{headerLabel}</span>
                        <button onClick={goToday} className="text-xs px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-md hover:bg-indigo-500/30 transition-colors" aria-label="Go to today">Today</button>
                    </div>
                    <button onClick={goNext} className="px-3 py-1 text-slate-400 hover:text-white transition-colors" aria-label={`Next ${calMode}`}>▶</button>
                </div>
            )}

            {/* View Content */}
            {calMode === 'month' && renderMonth()}
            {calMode === 'week' && renderWeek()}
            {calMode === 'agenda' && renderAgenda()}

            {/* Legend */}
            <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" /> Assignment</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-500" /> Exam</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Class</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-purple-500" /> Goal</span>
            </div>

            {/* Day Detail Bottom-Sheet Modal */}
            {renderDayModal()}
        </div>
    );
});

// ============================================================================
// SECTION 8E: GOAL VIEW
// ============================================================================

export const GoalView = memo(() => {
    const { state, dispatch } = useApp();
    const [showAdd, setShowAdd] = useState(false);
    const [goalForm, setGoalForm] = useState({ title: '', description: '', category: 'Academic', deadline: '', milestones: [] });
    const [milestoneText, setMilestoneText] = useState('');
    
    const goals = state.goals || [];
    const activeGoals = goals.filter(g => g.status !== 'completed');
    const completedGoals = goals.filter(g => g.status === 'completed');
    
    const handleAddGoal = () => {
        if (!goalForm.title.trim()) return;
        const newGoal = {
            id: crypto.randomUUID(),
            ...goalForm,
            milestones: goalForm.milestones.map(m => ({ id: crypto.randomUUID(), text: m, completed: false })),
            progress: 0,
            status: 'active',
            linkedHabits: [],
            createdAt: new Date().toISOString()
        };
        dispatch({ type: ActionTypes.ADD_GOAL, payload: newGoal });
        dispatch({ type: ActionTypes.ADD_XP, payload: { amount: 10 } });
        setGoalForm({ title: '', description: '', category: 'Academic', deadline: '', milestones: [] });
        setShowAdd(false);
        showToast('Goal added +10 XP', 'success');
    };
    
    const handleToggleMilestone = (goalId, milestoneId) => {
        dispatch({ type: ActionTypes.TOGGLE_MILESTONE, payload: { goalId, milestoneId } });
        dispatch({ type: ActionTypes.ADD_XP, payload: { amount: 10 } });
        showToast('Milestone updated +10 XP', 'success');
    };
    
    const handleCompleteGoal = (goalId) => {
        dispatch({ type: ActionTypes.UPDATE_GOAL, payload: { id: goalId, status: 'completed', completedAt: new Date().toISOString() } });
        dispatch({ type: ActionTypes.ADD_XP, payload: { amount: 50 } });
        if (typeof confetti === 'function') confetti({ particleCount: 100, spread: 70 });
        showToast('Goal completed! +50 XP 🎉', 'success');
    };
    
    const handleDeleteGoal = (goalId) => {
        if (confirm('Delete this goal?')) {
            dispatch({ type: ActionTypes.DELETE_GOAL, payload: goalId });
            showToast('Goal deleted');
        }
    };
    
    const getGoalProgress = (goal) => {
        const milestones = goal.milestones || [];
        if (milestones.length === 0) return goal.progress || 0;
        const done = milestones.filter(m => m.completed || m.done).length;
        return Math.round((done / milestones.length) * 100);
    };
    
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-white mb-1">🎯 Goals</h2>
                <p className="text-slate-400 text-sm">Set goals with milestones and track your progress</p>
            </div>
            
            <button onClick={() => setShowAdd(true)} className="w-full py-3 bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-indigo-400 font-medium hover:bg-indigo-500/30 transition-colors">
                + Add Goal
            </button>
            
            {showAdd && (
                <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700 space-y-3">
                    <input type="text" value={goalForm.title} onChange={e => setGoalForm(p => ({...p, title: e.target.value}))}
                        placeholder="Goal title" className="w-full px-3 py-2 bg-slate-800 rounded-lg border border-slate-600 text-white text-sm" />
                    <textarea value={goalForm.description} onChange={e => setGoalForm(p => ({...p, description: e.target.value}))}
                        placeholder="Description" rows={2} className="w-full px-3 py-2 bg-slate-800 rounded-lg border border-slate-600 text-white text-sm resize-none" />
                    <div className="flex gap-2">
                        <select value={goalForm.category} onChange={e => setGoalForm(p => ({...p, category: e.target.value}))}
                            className="flex-1 px-3 py-2 bg-slate-800 rounded-lg border border-slate-600 text-white text-sm">
                            {['Academic','Personal','Health','Financial','Career'].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <input type="date" value={goalForm.deadline} onChange={e => setGoalForm(p => ({...p, deadline: e.target.value}))}
                            className="flex-1 px-3 py-2 bg-slate-800 rounded-lg border border-slate-600 text-white text-sm" />
                    </div>
                    
                    {/* Milestones */}
                    <div className="space-y-2">
                        <label className="text-sm text-slate-400">Milestones:</label>
                        {goalForm.milestones.map((m, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <span className="text-sm text-white flex-1">{m}</span>
                                <button onClick={() => setGoalForm(p => ({...p, milestones: p.milestones.filter((_, idx) => idx !== i)}))}
                                    className="text-rose-400 text-xs" aria-label="Remove milestone">✕</button>
                            </div>
                        ))}
                        <div className="flex gap-2">
                            <input type="text" value={milestoneText} onChange={e => setMilestoneText(e.target.value)}
                                placeholder="Add milestone" className="flex-1 px-2 py-1 bg-slate-700 rounded text-white text-xs border border-slate-600"
                                onKeyDown={e => { if (e.key === 'Enter' && milestoneText.trim()) { setGoalForm(p => ({...p, milestones: [...p.milestones, milestoneText.trim()]})); setMilestoneText(''); }}} />
                            <button onClick={() => { if (milestoneText.trim()) { setGoalForm(p => ({...p, milestones: [...p.milestones, milestoneText.trim()]})); setMilestoneText(''); }}}
                                className="px-3 py-1 bg-slate-700 rounded text-slate-300 text-xs">Add</button>
                        </div>
                    </div>
                    
                    <div className="flex gap-2">
                        <button onClick={handleAddGoal} className="flex-1 py-2 bg-indigo-500 rounded-lg text-white text-sm font-medium">Create Goal</button>
                        <button onClick={() => setShowAdd(false)} className="flex-1 py-2 bg-slate-700 rounded-lg text-slate-300 text-sm">Cancel</button>
                    </div>
                </div>
            )}
            
            {/* Active Goals */}
            {activeGoals.length === 0 && completedGoals.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                    <div className="text-4xl mb-3">🎯</div>
                    <p className="font-medium text-white mb-1">No goals yet</p>
                    <p className="text-sm">Set your first goal and start making progress!</p>
                </div>
            ) : (
                <>
                    {activeGoals.map(goal => {
                        const progress = getGoalProgress(goal);
                        const daysLeft = goal.deadline ? Math.ceil((new Date(goal.deadline) - new Date()) / (1000 * 60 * 60 * 24)) : null;
                        return (
                            <div key={goal.id} className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-bold text-white">{goal.title}</h3>
                                        <span className="text-xs text-slate-400">{goal.category}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        {progress === 100 && (
                                            <button onClick={() => handleCompleteGoal(goal.id)} className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded font-medium">
                                                Complete ✓
                                            </button>
                                        )}
                                        <button onClick={() => handleDeleteGoal(goal.id)} className="text-slate-400 hover:text-rose-400 text-sm" aria-label="Delete goal">🗑️</button>
                                    </div>
                                </div>
                                
                                {goal.description && <p className="text-sm text-slate-400">{goal.description}</p>}
                                
                                {/* Progress Bar */}
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs text-slate-400">
                                        <span>Progress</span>
                                        <span>{progress}%</span>
                                    </div>
                                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500 rounded-full" style={{ width: `${progress}%` }} />
                                    </div>
                                </div>
                                
                                {daysLeft !== null && (
                                    <span className={`text-xs ${daysLeft < 0 ? 'text-rose-400' : daysLeft <= 3 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                        {daysLeft < 0 ? `${Math.abs(daysLeft)} days overdue` : `${daysLeft} days remaining`}
                                    </span>
                                )}
                                
                                {/* Milestones */}
                                {(goal.milestones || []).length > 0 && (
                                    <div className="space-y-1">
                                        {goal.milestones.map(m => (
                                            <button key={m.id} onClick={() => handleToggleMilestone(goal.id, m.id)}
                                                className="w-full flex items-center gap-2 p-2 bg-slate-900/50 rounded-lg hover:bg-slate-900 transition-colors text-left">
                                                <span className={`text-sm ${m.completed || m.done ? 'text-emerald-400' : 'text-slate-500'}`}>
                                                    {m.completed || m.done ? '✅' : '⬜'}
                                                </span>
                                                <span className={`text-sm ${m.completed || m.done ? 'text-slate-400 line-through' : 'text-white'}`}>{m.text}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    
                    {/* Completed Goals */}
                    {completedGoals.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-slate-400">Completed Goals</h3>
                            {completedGoals.map(goal => (
                                <div key={goal.id} className="bg-emerald-500/5 rounded-xl border border-emerald-500/20 p-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">🏆</span>
                                        <span className="text-sm text-slate-300 line-through">{goal.title}</span>
                                    </div>
                                    <button onClick={() => handleDeleteGoal(goal.id)} className="text-slate-500 hover:text-rose-400 text-xs" aria-label="Delete goal">🗑️</button>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
});

// ============================================================================
// SECTION 8F: NOTIFICATION CENTER
// ============================================================================

export const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);

// Error boundary wrapper
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    
    componentDidCatch(error, errorInfo) {
        console.error('App Error:', error, errorInfo);
    }
    
    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                    <div className="text-center max-w-md">
                        <div className="text-6xl mb-4">😵</div>
                        <h1 className="text-xl font-bold text-white mb-2">Something went wrong</h1>
                        <p className="text-slate-400 text-sm mb-6">
                            The app encountered an error. Your data is safe in local storage.
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-medium transition-colors"
                        >
                            Reload App
                        </button>
                        <details className="mt-6 text-left">
                            <summary className="text-slate-500 text-xs cursor-pointer">
                                Error details
                            </summary>
                            <pre className="mt-2 p-3 bg-slate-800 rounded-lg text-xs text-rose-400 overflow-auto">
                                {this.state.error?.toString()}
                            </pre>
                        </details>
                    </div>
                </div>
            );
        }
        
        return this.props.children;
    }
}

// Render with error boundary
root.render(
    <ErrorBoundary>
        <App />
    </ErrorBoundary>
);

// ============================================================================
// SECTION 11: SERVICE WORKER & PWA SETUP
// ============================================================================

// Register service worker for offline support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered');
        } catch (error) {
            console.log('Service Worker registration skipped:', error.message);
        }
    });
}

// Install prompt handling
export let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // Check if user hasn't dismissed recently
    const lastDismissed = localStorage.getItem('install-prompt-dismissed');
    const daysSinceDismissed = lastDismissed 
        ? (Date.now() - parseInt(lastDismissed)) / (1000 * 60 * 60 * 24)
        : Infinity;
    
    if (daysSinceDismissed > 7) {
        // Show install prompt after 30 seconds of usage
        setTimeout(() => {
            if (deferredPrompt && confirm('Install StudentOS for quick access and offline support?')) {
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then((choice) => {
                    if (choice.outcome === 'accepted') {
                        showToast('App installed! 🎉', 'success');
                    }
                    deferredPrompt = null;
                });
            } else {
                localStorage.setItem('install-prompt-dismissed', Date.now().toString());
            }
        }, 30000);
    }
});

window.addEventListener('appinstalled', () => {
    console.log('App installed');
    deferredPrompt = null;
});

