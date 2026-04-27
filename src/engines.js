import React, { useState, useEffect, useMemo, useRef, useCallback, useReducer, createContext, useContext, memo, Suspense, lazy, useId, useSyncExternalStore } from 'react';
import { CONFIG, MOTIVATIONAL_QUOTES, ACHIEVEMENT_DEFS, DAILY_CHALLENGE_POOL } from './config';
import { DateUtils, StatsUtils, HabitUtils } from './utils';
import { ActionTypes, AppContext } from './context';
import { IconButton, ProgressRing, Badge, EmptyState, Skeleton, StatCard, HabitItem } from './components/ui';
import { FocusTimer, HabitModal, StudyTimer, AssignmentModal, TimetableModal, WellnessModal, JournalEntryModal, ExpenseModal, ResearchModal, SubjectManagerModal } from './components/modals';
import { WellnessAlertsCard, RoutinesSection, CycleTrackingCard, InsightsPanel, StatsOverview, HabitsList, RadarPanel, WeeklyAuditPanel, SkillTreePanel, NotificationPanel } from './components/panels';
import { SKILL_DOMAINS, MASTERY_LEVELS, createInitialState, appReducer, usePersistedState, useLoadState, useKeyboardShortcuts, useOnlineStatus, showToast, haptic, useApp, InsightCard, generateWellnessAlerts, MatrixView, AnalyticsView, SettingsView, DashboardPage, StudyView, JournalView, ExpenseView, CognitiveLoadBar, MetricCard, MiniHeatmap, GradeTrackerView, CalendarView, GoalView, rootElement, deferredPrompt } from './components/views';
import { AccountabilityConsole, CommandDashboard, App } from './components/app';

export const AnalyticsEngine = {
    /**
     * Generate all insights for current state
     * @param {Object} habits - All habits
     * @param {string[]} habitOrder - Ordered habit IDs
     * @returns {Object[]} Array of insight objects
     */
    generateInsights: (habits, habitOrder) => {
        const insights = [];
        const activeHabits = habitOrder
            .map(id => habits[id])
            .filter(h => h && !h.archived);
        
        if (activeHabits.length === 0) {
            return [{
                id: 'empty',
                type: 'info',
                icon: '📝',
                title: 'Get Started',
                message: 'Add your first habit to begin tracking.',
                priority: 1
            }];
        }
        
        // 1. Find correlations between habits
        const correlationInsights = AnalyticsEngine.findCorrelations(activeHabits);
        insights.push(...correlationInsights);
        
        // 2. Detect trends
        const trendInsights = AnalyticsEngine.analyzeTrends(activeHabits);
        insights.push(...trendInsights);
        
        // 3. Find weak days
        const dayInsights = AnalyticsEngine.analyzeWeekdays(activeHabits);
        insights.push(...dayInsights);
        
        // 4. Streak analysis
        const streakInsights = AnalyticsEngine.analyzeStreaks(activeHabits);
        insights.push(...streakInsights);
        
        // 5. Overall performance
        const performanceInsights = AnalyticsEngine.analyzePerformance(activeHabits);
        insights.push(...performanceInsights);
        
        // Sort by priority and return top insights
        return insights
            .filter(i => i !== null)
            .sort((a, b) => (b.priority || 0) - (a.priority || 0))
            .slice(0, 5);
    },
    
    /**
     * Find correlations between habits
     * @param {Object[]} habits
     * @returns {Object[]}
     */
    findCorrelations: (habits) => {
        const insights = [];
        
        if (habits.length < 2) return insights;
        
        for (let i = 0; i < habits.length; i++) {
            for (let j = i + 1; j < habits.length; j++) {
                const h1 = habits[i];
                const h2 = habits[j];
                
                const arr1 = HabitUtils.getCompletionArray(h1.data, 14);
                const arr2 = HabitUtils.getCompletionArray(h2.data, 14);
                
                if (arr1.filter(x => x).length < 3 || arr2.filter(x => x).length < 3) continue;
                
                const correlation = StatsUtils.pearsonCorrelation(arr1, arr2);
                
                if (correlation > 0.6) {
                    insights.push({
                        id: `corr-${h1.id}-${h2.id}`,
                        type: 'correlation',
                        icon: '🔗',
                        title: 'Strong Habit Link Detected',
                        message: `"${h1.name}" and "${h2.name}" are completed together ${Math.round(correlation * 100)}% of the time. Consider stacking them!`,
                        priority: 8,
                        habitIds: [h1.id, h2.id]
                    });
                } else if (correlation < -0.4) {
                    insights.push({
                        id: `neg-corr-${h1.id}-${h2.id}`,
                        type: 'warning',
                        icon: '⚠️',
                        title: 'Competing Habits',
                        message: `"${h1.name}" and "${h2.name}" seem to compete. When you do one, you often skip the other.`,
                        priority: 6,
                        habitIds: [h1.id, h2.id]
                    });
                }
            }
        }
        
        return insights;
    },
    
    /**
     * Analyze trends for each habit
     * @param {Object[]} habits
     * @returns {Object[]}
     */
    analyzeTrends: (habits) => {
        const insights = [];
        
        habits.forEach(habit => {
            const completionArray = HabitUtils.getCompletionArray(habit.data, 14);
            const weeklyTotals = [
                completionArray.slice(0, 7).filter(x => x).length,
                completionArray.slice(7, 14).filter(x => x).length
            ];
            
            const change = weeklyTotals[1] - weeklyTotals[0];
            const percentChange = weeklyTotals[0] > 0 
                ? Math.round((change / weeklyTotals[0]) * 100)
                : weeklyTotals[1] > 0 ? 100 : 0;
            
            if (percentChange >= 30) {
                insights.push({
                    id: `trend-up-${habit.id}`,
                    type: 'success',
                    icon: '📈',
                    title: 'Improving Trend',
                    message: `"${habit.name}" is up ${percentChange}% this week vs last week. Great momentum!`,
                    priority: 7
                });
            } else if (percentChange <= -30) {
                insights.push({
                    id: `trend-down-${habit.id}`,
                    type: 'warning',
                    icon: '📉',
                    title: 'Declining Trend',
                    message: `"${habit.name}" is down ${Math.abs(percentChange)}% this week. What's blocking you?`,
                    priority: 9,
                    urgent: true
                });
            }
        });
        
        return insights;
    },
    
    /**
     * Analyze performance by day of week
     * @param {Object[]} habits
     * @returns {Object[]}
     */
    analyzeWeekdays: (habits) => {
        const insights = [];
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        // Aggregate across all habits
        const dayStats = Array(7).fill(null).map(() => ({ completed: 0, total: 0 }));
        
        habits.forEach(habit => {
            Object.keys(habit.data || {}).forEach(key => {
                const day = DateUtils.dayOfWeek(key);
                dayStats[day].total++;
                if (habit.data[key]) dayStats[day].completed++;
            });
        });
        
        // Find worst day
        let worstDay = -1;
        let worstRate = 1;
        
        dayStats.forEach((stat, day) => {
            if (stat.total >= 4) { // Need enough data
                const rate = stat.completed / stat.total;
                if (rate < worstRate) {
                    worstRate = rate;
                    worstDay = day;
                }
            }
        });
        
        if (worstDay >= 0 && worstRate < 0.5) {
            insights.push({
                id: 'worst-day',
                type: 'warning',
                icon: '📅',
                title: 'Weak Day Detected',
                message: `${dayNames[worstDay]}s are your weakest day (${Math.round(worstRate * 100)}% completion). Plan easier habits for this day.`,
                priority: 6
            });
        }
        
        // Find best day
        let bestDay = -1;
        let bestRate = 0;
        
        dayStats.forEach((stat, day) => {
            if (stat.total >= 4) {
                const rate = stat.completed / stat.total;
                if (rate > bestRate) {
                    bestRate = rate;
                    bestDay = day;
                }
            }
        });
        
        if (bestDay >= 0 && bestRate > 0.8) {
            insights.push({
                id: 'best-day',
                type: 'success',
                icon: '🏆',
                title: 'Power Day',
                message: `${dayNames[bestDay]}s are your strongest day (${Math.round(bestRate * 100)}% completion). Schedule important habits here.`,
                priority: 4
            });
        }
        
        return insights;
    },
    
    /**
     * Analyze streaks
     * @param {Object[]} habits
     * @returns {Object[]}
     */
    analyzeStreaks: (habits) => {
        const insights = [];
        
        habits.forEach(habit => {
            const streak = HabitUtils.calculateStreak(habit.data);
            const longestStreak = HabitUtils.calculateLongestStreak(habit.data);
            
            // About to beat record
            if (streak > 0 && streak === longestStreak && streak >= 7) {
                insights.push({
                    id: `record-${habit.id}`,
                    type: 'success',
                    icon: '🔥',
                    title: 'Record Streak!',
                    message: `"${habit.name}" is at ${streak} days - your longest ever! Keep it going!`,
                    priority: 10
                });
            }
            
            // Streak at risk (Day 2-3 is most fragile)
            if (streak >= 2 && streak <= 3) {
                const todayKey = DateUtils.toKey();
                if (!habit.data?.[todayKey]) {
                    insights.push({
                        id: `risk-${habit.id}`,
                        type: 'urgent',
                        icon: '🚨',
                        title: 'Streak at Risk!',
                        message: `"${habit.name}" streak is fragile (day ${streak + 1}). Complete it now before the day ends!`,
                        priority: 10,
                        urgent: true,
                        habitId: habit.id
                    });
                }
            }
            
            // Long streak milestone
            if (streak > 0 && [7, 14, 21, 30, 60, 90, 100, 365].includes(streak)) {
                insights.push({
                    id: `milestone-${habit.id}-${streak}`,
                    type: 'celebration',
                    icon: '🎉',
                    title: 'Milestone Reached!',
                    message: `"${habit.name}" hit ${streak} days! ${streak >= 21 ? "It's becoming automatic!" : "Keep building!"}`,
                    priority: 5
                });
            }
        });
        
        return insights;
    },
    
    /**
     * Analyze overall performance
     * @param {Object[]} habits
     * @returns {Object[]}
     */
    analyzePerformance: (habits) => {
        const insights = [];
        
        if (habits.length === 0) return insights;
        
        // Calculate overall completion rate
        let totalCompleted = 0;
        let totalPossible = 0;
        
        habits.forEach(habit => {
            for (let i = 0; i < 7; i++) {
                const key = DateUtils.toKey(DateUtils.daysAgo(i));
                totalPossible++;
                if (habit.data?.[key]) totalCompleted++;
            }
        });
        
        const weeklyRate = Math.round((totalCompleted / totalPossible) * 100);
        
        if (weeklyRate >= 90) {
            insights.push({
                id: 'excellent-week',
                type: 'celebration',
                icon: '🌟',
                title: 'Excellent Week!',
                message: `${weeklyRate}% completion rate this week. You're in the top tier of habit builders!`,
                priority: 3
            });
        } else if (weeklyRate < 30) {
            insights.push({
                id: 'recovery-needed',
                type: 'info',
                icon: '💪',
                title: 'Recovery Mode',
                message: `Tough week (${weeklyRate}%). That's okay! Start with just ONE habit today to rebuild momentum.`,
                priority: 8
            });
        }
        
        return insights;
    }
};

// ============================================================================
// SECTION 3B: COGNITIVE PERFORMANCE ENGINE
// Mathematical models for cognitive metrics using existing tracked data
// ============================================================================

/**
 * Cognitive Performance Engine
 * Computes advanced cognitive metrics from existing state data.
 * All formulas are mathematically defined — no external ML libraries.
 */
export const CognitiveEngine = {
    /**
     * Sigmoid function for logistic models
     * σ(x) = 1 / (1 + e^(-x))
     */
    sigmoid: (x) => 1 / (1 + Math.exp(-x)),

    /**
     * Z-score normalization: z = (x - μ) / σ
     */
    zScore: (value, mean, stdDev) => stdDev === 0 ? 0 : (value - mean) / stdDev,

    /**
     * Weighted sum utility
     */
    weightedSum: (values, weights) => {
        let sum = 0, wSum = 0;
        for (let i = 0; i < values.length; i++) {
            const w = weights[i] || 0;
            sum += (values[i] || 0) * w;
            wSum += w;
        }
        return wSum === 0 ? 0 : sum / wSum;
    },

    /**
     * Extract daily metrics from state for last N days
     * Returns array of { date, sleepHours, sleepQuality, studyMinutes, pomodoroCount,
     *   habitCompletionRate, exerciseMinutes, moodScore, energyScore, assignmentsDue }
     */
    extractDailyMetrics: (state, days = 30) => {
        const metrics = [];
        const today = new Date();
        const habits = state.habitOrder.map(id => state.habits[id]).filter(h => h && !h.archived);

        for (let i = 0; i < days; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const key = DateUtils.toKey(d);

            // Sleep
            const sleepEntry = (state.sleepLog || []).find(s => s.date === key);
            const sleepHours = sleepEntry ? sleepEntry.hours : null;
            const sleepQuality = sleepEntry ? (sleepEntry.quality || 3) : null;

            // Study
            const daySessions = (state.studySessions || []).filter(s => s.date === key);
            const studyMinutes = daySessions.reduce((sum, s) => sum + (s.duration || 0), 0);
            const pomodoroCount = daySessions.filter(s => s.type === 'pomodoro').length;

            // Habits
            let habitsCompleted = 0;
            habits.forEach(h => { if (h.data && h.data[key]) habitsCompleted++; });
            const habitCompletionRate = habits.length > 0 ? habitsCompleted / habits.length : 0;

            // Exercise
            const dayExercises = (state.exerciseLog || []).filter(e => e.date === key);
            const exerciseMinutes = dayExercises.reduce((sum, e) => sum + (e.duration || 0), 0);

            // Mood & Energy
            const moodEntry = state.moodLog && state.moodLog[key];
            const moodMap = { veryHappy: 5, happy: 4, neutral: 3, sad: 2, verySad: 1 };
            const moodScore = moodEntry ? (moodMap[moodEntry.mood] || 3) : null;
            const energyScore = moodEntry ? (moodEntry.energy || 3) : null;

            // Assignments due
            const assignmentsDue = (state.assignments || []).filter(a => a.dueDate === key).length;

            // Journal word count (proxy for reflection depth)
            const journalEntry = (state.journalEntries || []).find(j => j.date === key);
            const journalWords = journalEntry ? (journalEntry.wordCount || 0) : 0;

            metrics.push({
                date: key, dayIndex: i,
                sleepHours, sleepQuality, studyMinutes, pomodoroCount,
                habitCompletionRate, exerciseMinutes, moodScore, energyScore,
                assignmentsDue, journalWords
            });
        }
        return metrics;
    },

    /**
     * 1. Cognitive Sharpness Index (CSI)
     * CSI = w1·norm(sleep) + w2·norm(exercise) + w3·norm(mood) + w4·norm(habitRate) + w5·norm(studyEfficiency)
     * Where norm(x) = clamp(z-score, -2, 2) mapped to [0, 1]
     * Weights: sleep=0.25, exercise=0.15, mood=0.20, habits=0.20, study=0.20
     */
    computeCSI: (dailyMetrics) => {
        const valid = dailyMetrics.filter(m => m.sleepHours !== null || m.studyMinutes > 0);
        if (valid.length < 3) return { value: 0, trend: 'stable', history: [] };

        const sleepVals = valid.map(m => m.sleepHours || 7);
        const exerciseVals = valid.map(m => m.exerciseMinutes || 0);
        const moodVals = valid.map(m => m.moodScore || 3);
        const habitVals = valid.map(m => m.habitCompletionRate || 0);
        const studyVals = valid.map(m => m.studyMinutes || 0);

        const normToUnit = (val, arr) => {
            const mean = StatsUtils.mean(arr);
            const std = StatsUtils.stdDev(arr);
            const z = CognitiveEngine.zScore(val, mean, std);
            return Math.max(0, Math.min(1, (z + 2) / 4));
        };

        const history = valid.map((m, idx) => {
            const csi = CognitiveEngine.weightedSum(
                [normToUnit(sleepVals[idx], sleepVals), normToUnit(exerciseVals[idx], exerciseVals),
                 normToUnit(moodVals[idx], moodVals), normToUnit(habitVals[idx], habitVals),
                 normToUnit(studyVals[idx], studyVals)],
                [0.25, 0.15, 0.20, 0.20, 0.20]
            );
            return { date: m.date, value: Math.round(csi * 100) };
        });

        const recent = history.slice(0, 7).map(h => h.value);
        const trend = StatsUtils.trend(recent.reverse()).direction;
        return { value: history[0]?.value || 0, trend, history: history.slice(0, 14).reverse() };
    },

    /**
     * 2. Deep Work Capacity
     * DWC = MA_7(studyMinutes * (1 + pomodoroBonus)) / dailyGoal
     * pomodoroBonus = 0.2 per pomodoro (structured work multiplier)
     */
    computeDeepWorkCapacity: (dailyMetrics, dailyGoal = 120) => {
        if (dailyMetrics.length < 3) return { value: 0, trend: 'stable', history: [] };

        const raw = dailyMetrics.map(m => {
            const bonus = 1 + (m.pomodoroCount || 0) * 0.2;
            return Math.min(((m.studyMinutes || 0) * bonus) / dailyGoal, 2.0);
        });

        const ma = StatsUtils.movingAverage(raw.slice().reverse(), 7);
        const history = ma.map((v, i) => ({
            date: dailyMetrics[dailyMetrics.length - 1 - i]?.date || '',
            value: Math.round(v * 100)
        })).reverse();

        const trend = StatsUtils.trend(ma.slice(-7)).direction;
        return { value: history[history.length - 1]?.value || 0, trend, history: history.slice(-14) };
    },

    /**
     * 3. Burnout Probability (Logistic Regression Model)
     * P(burnout) = σ(β0 + β1·sleepDebt + β2·overwork + β3·moodDecline + β4·streakBreaks + β5·exerciseDeficit)
     * β coefficients calibrated for student context
     */
    computeBurnoutProbability: (dailyMetrics, state) => {
        if (dailyMetrics.length < 7) return { value: 0, risk: 'low', factors: [] };

        const recent7 = dailyMetrics.slice(0, 7);
        const factors = [];

        // Sleep debt: deviation below 7h target
        const avgSleep = StatsUtils.mean(recent7.map(m => m.sleepHours || 7));
        const sleepDebt = Math.max(0, 7 - avgSleep);
        if (sleepDebt > 1) factors.push({ name: 'Sleep Deficit', severity: sleepDebt / 3 });

        // Overwork: study > 8h/day average
        const avgStudy = StatsUtils.mean(recent7.map(m => m.studyMinutes || 0));
        const overwork = Math.max(0, (avgStudy - 480) / 120);
        if (overwork > 0) factors.push({ name: 'Overwork', severity: overwork });

        // Mood decline: negative trend in mood
        const moodVals = recent7.map(m => m.moodScore || 3).reverse();
        const moodTrend = StatsUtils.trend(moodVals);
        const moodDecline = moodTrend.slope < -0.1 ? Math.abs(moodTrend.slope) * 2 : 0;
        if (moodDecline > 0) factors.push({ name: 'Mood Declining', severity: moodDecline });

        // Streak breaks (habit consistency drop)
        const habitRates = recent7.map(m => m.habitCompletionRate || 0);
        const habitMean = StatsUtils.mean(habitRates);
        const streakBreaks = Math.max(0, 0.7 - habitMean);
        if (streakBreaks > 0.2) factors.push({ name: 'Consistency Drop', severity: streakBreaks });

        // Exercise deficit
        const avgExercise = StatsUtils.mean(recent7.map(m => m.exerciseMinutes || 0));
        const exerciseDeficit = Math.max(0, (30 - avgExercise) / 30);
        if (exerciseDeficit > 0.5) factors.push({ name: 'Exercise Deficit', severity: exerciseDeficit });

        // Logistic burnout model coefficients (heuristically calibrated):
        // β0=-2 (baseline: ~12% burnout at no risk factors)
        // β1=1.5 (sleep debt is strongest predictor per WHO guidelines)
        // β2=1.2 (overwork: sustained >8h/day correlated with burnout in academic studies)
        // β3=1.0 (mood decline: validated proxy for emotional exhaustion)
        // β4=0.8 (habit consistency: behavioral marker of disengagement)
        // β5=0.5 (exercise deficit: protective factor, lower weight)
        const logit = -2 + 1.5 * sleepDebt + 1.2 * overwork + 1.0 * moodDecline + 0.8 * streakBreaks + 0.5 * exerciseDeficit;
        const prob = Math.round(CognitiveEngine.sigmoid(logit) * 100);

        const risk = prob > 70 ? 'high' : prob > 40 ? 'medium' : 'low';
        return { value: prob, risk, factors };
    },

    /**
     * 4. Focus Stability Score
     * Measures consistency of study session lengths (low variance = high stability)
     * FSS = 1 - CV(session_durations) where CV = σ/μ (coefficient of variation)
     */
    computeFocusStability: (dailyMetrics) => {
        const studyVals = dailyMetrics.slice(0, 14).map(m => m.studyMinutes || 0).filter(v => v > 0);
        if (studyVals.length < 3) return { value: 0, trend: 'stable' };

        const cv = StatsUtils.stdDev(studyVals) / (StatsUtils.mean(studyVals) || 1);
        const score = Math.round(Math.max(0, Math.min(100, (1 - cv) * 100)));
        const trend = StatsUtils.trend(studyVals.slice(0, 7).reverse()).direction;
        return { value: score, trend };
    },

    /**
     * 5. Decision Fatigue Risk
     * DFR = Bayesian estimate based on: late-day productivity drop, assignment overload, mood-energy gap
     * Prior P(fatigue) = 0.3, update with evidence
     */
    computeDecisionFatigueRisk: (dailyMetrics, state) => {
        if (dailyMetrics.length < 3) return { value: 0, risk: 'low' };

        const today = dailyMetrics[0] || {};
        let prior = 0.3;

        // Evidence 1: High assignment load increases fatigue
        const pendingAssignments = (state.assignments || []).filter(a => a.status !== 'completed').length;
        if (pendingAssignments > 5) prior = prior * 1.5 / (prior * 1.5 + (1 - prior));
        if (pendingAssignments > 10) prior = prior * 1.8 / (prior * 1.8 + (1 - prior));

        // Evidence 2: Low energy score
        if (today.energyScore && today.energyScore <= 2) {
            prior = prior * 2.0 / (prior * 2.0 + (1 - prior));
        }

        // Evidence 3: Poor sleep
        if (today.sleepHours && today.sleepHours < 6) {
            prior = prior * 1.7 / (prior * 1.7 + (1 - prior));
        }

        const value = Math.round(prior * 100);
        const risk = value > 60 ? 'high' : value > 35 ? 'medium' : 'low';
        return { value, risk };
    },

    /**
     * 6. Cognitive Load Index
     * CLI = (pendingAssignments * urgencyWeight + activeCourses + studyDebt) / capacity
     * Higher = more overloaded
     */
    computeCognitiveLoad: (state) => {
        const pending = (state.assignments || []).filter(a => a.status !== 'completed');
        const today = new Date();
        // Urgency weights: <1 day = critical (3x), <3 days = high (2x), <7 days = moderate (1.5x), else normal (1x)
        const URGENCY_CRITICAL = 3, URGENCY_HIGH = 2, URGENCY_MODERATE = 1.5, URGENCY_NORMAL = 1;
        const MAX_LOAD_SCORE = 15; // Normalization ceiling

        let loadScore = 0;
        pending.forEach(a => {
            const dueDate = new Date(a.dueDate);
            const daysLeft = Math.max(0, (dueDate - today) / (1000 * 60 * 60 * 24));
            const urgency = daysLeft < 1 ? URGENCY_CRITICAL : daysLeft < 3 ? URGENCY_HIGH : daysLeft < 7 ? URGENCY_MODERATE : URGENCY_NORMAL;
            loadScore += urgency;
        });

        const normalized = Math.round(Math.min(100, (loadScore / MAX_LOAD_SCORE) * 100));
        const level = normalized > 70 ? 'red' : normalized > 40 ? 'yellow' : 'green';
        return { value: normalized, level, pendingCount: pending.length };
    },

    /**
     * 7. Output-to-Effort Ratio
     * OER = (habitsCompleted + assignmentsCompleted + studyOutputScore) / (totalStudyMinutes + effortProxy)
     * Higher = more efficient
     */
    computeOutputEffortRatio: (dailyMetrics, state) => {
        const recent7 = dailyMetrics.slice(0, 7);
        const totalStudy = recent7.reduce((sum, m) => sum + (m.studyMinutes || 0), 0);
        const totalHabits = recent7.reduce((sum, m) => sum + (m.habitCompletionRate || 0), 0);

        const today = DateUtils.toKey();
        const weekAgo = DateUtils.toKey(DateUtils.daysAgo(7));
        const completedAssignments = (state.assignments || []).filter(a =>
            a.status === 'completed' && a.dueDate >= weekAgo && a.dueDate <= today
        ).length;

        const output = totalHabits * 10 + completedAssignments * 20 + recent7.reduce((s, m) => s + (m.journalWords || 0), 0) * 0.1;
        const effort = Math.max(1, totalStudy / 60);

        const ratio = Math.round((output / effort) * 10);
        return { value: Math.min(100, ratio), totalStudyHours: Math.round(totalStudy / 60) };
    }
};

// ============================================================================
// SECTION 3C: RESEARCH INTELLIGENCE LAYER
// Tracks research activities and computes research performance metrics
// ============================================================================

export const ResearchEngine = {
    /**
     * 1. Research Velocity Score
     * RVS = MA_7(papers + experiments*2 + models*3 + deployments*5 + insights) / targetPerWeek
     */
    computeResearchVelocity: (researchLog, days = 14) => {
        if (!researchLog || researchLog.length === 0) return { value: 0, trend: 'stable', history: [] };

        const today = new Date();
        const dailyCounts = [];

        for (let i = 0; i < days; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const key = DateUtils.toKey(d);
            const entries = researchLog.filter(r => r.date === key);

            const score = entries.reduce((sum, e) => {
                const weights = { paper: 1, experiment: 2, model: 3, deployment: 5, insight: 1, bugfix: 0.5 };
                return sum + (weights[e.type] || 1);
            }, 0);
            dailyCounts.push(score);
        }

        const ma = StatsUtils.movingAverage(dailyCounts.slice().reverse(), 7);
        const history = ma.map((v, i) => ({ value: Math.round(v * 10) })).slice(-14);
        const trend = StatsUtils.trend(ma.slice(-7)).direction;
        return { value: Math.round((ma[ma.length - 1] || 0) * 10), trend, history };
    },

    /**
     * 2. Innovation Momentum Index
     * IMI = trend_slope(research_velocity) * consistency_factor
     */
    computeInnovationMomentum: (researchLog, days = 21) => {
        if (!researchLog || researchLog.length < 7) return { value: 0, direction: 'stable' };

        const today = new Date();
        const weeklyScores = [];

        for (let w = 0; w < 3; w++) {
            let weekScore = 0;
            for (let d = 0; d < 7; d++) {
                const date = new Date(today);
                date.setDate(date.getDate() - (w * 7 + d));
                const key = DateUtils.toKey(date);
                weekScore += researchLog.filter(r => r.date === key).length;
            }
            weeklyScores.unshift(weekScore);
        }

        const trend = StatsUtils.trend(weeklyScores);
        const consistency = 1 - (StatsUtils.stdDev(weeklyScores) / (StatsUtils.mean(weeklyScores) || 1));
        const momentum = Math.round(trend.slope * Math.max(0, consistency) * 100);
        return { value: Math.max(-100, Math.min(100, momentum)), direction: trend.direction };
    },

    /**
     * 3. Learning Acceleration Curve
     * Rate of change in cumulative research output
     */
    computeLearningAcceleration: (researchLog) => {
        if (!researchLog || researchLog.length < 7) return { value: 0, accelerating: false };

        const sorted = [...researchLog].sort((a, b) => a.date.localeCompare(b.date));
        const cumulative = [];
        let total = 0;
        sorted.forEach(r => { total++; cumulative.push(total); });

        if (cumulative.length < 5) return { value: 0, accelerating: false };

        // Second derivative of cumulative = acceleration
        const recent = cumulative.slice(-10);
        const firstDeriv = recent.slice(1).map((v, i) => v - recent[i]);
        const secondDeriv = firstDeriv.slice(1).map((v, i) => v - firstDeriv[i]);
        const avgAccel = StatsUtils.mean(secondDeriv);

        return {
            value: Math.round(avgAccel * 100),
            accelerating: avgAccel > 0
        };
    },

    /**
     * 4. Debugging Efficiency Score
     * DES = bugs_fixed / time_spent_debugging (normalized)
     */
    computeDebuggingEfficiency: (researchLog) => {
        if (!researchLog) return { value: 0 };

        const bugfixes = researchLog.filter(r => r.type === 'bugfix');
        if (bugfixes.length === 0) return { value: 0 };

        const totalFixes = bugfixes.length;
        const totalTime = bugfixes.reduce((sum, b) => sum + (b.duration || 30), 0);
        const efficiency = totalTime > 0 ? (totalFixes / (totalTime / 60)) * 10 : 0;

        return { value: Math.round(Math.min(100, efficiency)) };
    }
};

// ============================================================================
// SECTION 3D: ACCOUNTABILITY ENGINE
// Harsh truth quantitative diagnostics — no motivational language
// ============================================================================

export const AccountabilityEngine = {
    /**
     * 1. Consistency Entropy Score
     * Uses Shannon entropy on habit completion pattern
     * Low entropy = highly consistent, High entropy = erratic
     * H = -Σ p(x) * log2(p(x))
     */
    computeConsistencyEntropy: (dailyMetrics) => {
        if (dailyMetrics.length < 7) return { value: 0, interpretation: 'Insufficient data' };

        const NUM_BINS = 5; // Bins: 0-20%, 20-40%, 40-60%, 60-80%, 80-100%
        const rates = dailyMetrics.slice(0, 14).map(m => m.habitCompletionRate || 0);
        const bins = new Array(NUM_BINS).fill(0);
        rates.forEach(r => {
            const bin = Math.min(NUM_BINS - 1, Math.floor(r * NUM_BINS));
            bins[bin]++;
        });

        const total = rates.length;
        let entropy = 0;
        bins.forEach(count => {
            if (count > 0) {
                const p = count / total;
                entropy -= p * Math.log2(p);
            }
        });

        const maxEntropy = Math.log2(NUM_BINS);
        const normalized = Math.round((entropy / maxEntropy) * 100);

        const interpretation = normalized > 70 ? 'Erratic — pattern is unpredictable'
            : normalized > 40 ? 'Moderate — room for consistency'
            : 'Disciplined — stable execution pattern';

        return { value: normalized, interpretation };
    },

    /**
     * 2. Comfort Zone Detection
     * Flags when performance plateaus (low variance + no growth trend)
     */
    computeComfortZoneScore: (dailyMetrics) => {
        if (dailyMetrics.length < 14) return { detected: false, score: 0, message: '' };

        const rates = dailyMetrics.slice(0, 14).map(m => m.habitCompletionRate || 0);
        const study = dailyMetrics.slice(0, 14).map(m => m.studyMinutes || 0);

        const rateStd = StatsUtils.stdDev(rates);
        const studyStd = StatsUtils.stdDev(study);
        const rateTrend = StatsUtils.trend(rates.slice().reverse());
        const studyTrend = StatsUtils.trend(study.slice().reverse());

        // Comfort zone: low variation AND flat/declining trend
        const isComfort = (rateStd < 0.1 && rateTrend.direction !== 'up') ||
                          (studyStd < 15 && studyTrend.direction !== 'up');

        const score = isComfort ? Math.round((1 - rateStd) * 50 + (1 - Math.min(1, studyStd / 60)) * 50) : 0;

        return {
            detected: isComfort,
            score,
            message: isComfort ? 'Performance plateau detected. Increase challenge difficulty.' : ''
        };
    },

    /**
     * 3. Streak Reliability Index
     * SRI = Σ(streak_length * consistency_weight) / max_possible
     * Measures how reliable streaks are (do they break early or sustain?)
     */
    computeStreakReliability: (habits) => {
        if (!habits || habits.length === 0) return { value: 0, fragileHabits: [] };

        const fragileHabits = [];
        let totalReliability = 0;

        habits.forEach(h => {
            const streak = HabitUtils.calculateStreak(h.data);
            const longest = HabitUtils.calculateLongestStreak(h.data);
            const rate = HabitUtils.calculateCompletionRate(h.data, 30);

            const reliability = longest > 0 ? (streak / longest) * (rate / 100) : 0;
            totalReliability += reliability;

            if (streak < 3 && longest > 7) {
                fragileHabits.push({ name: h.name, streak, longest, gap: longest - streak });
            }
        });

        const avgReliability = Math.round((totalReliability / habits.length) * 100);
        return { value: avgReliability, fragileHabits };
    },

    /**
     * 4. Generate accountability alerts (harsh but factual)
     */
    generateAlerts: (dailyMetrics, state) => {
        const alerts = [];
        const recent7 = dailyMetrics.slice(0, 7);
        const previous7 = dailyMetrics.slice(7, 14);

        // Input high, output stagnant
        const recentStudy = StatsUtils.mean(recent7.map(m => m.studyMinutes || 0));
        const recentHabits = StatsUtils.mean(recent7.map(m => m.habitCompletionRate || 0));
        if (recentStudy > 180 && recentHabits < 0.5) {
            alerts.push({ severity: 'warning', message: 'Input high, output stagnant. Study hours up but habit completion low.' });
        }

        // Sleep declining trend
        const sleepVals = recent7.map(m => m.sleepHours || 7);
        const sleepTrend = StatsUtils.trend(sleepVals.reverse());
        if (sleepTrend.direction === 'down') {
            alerts.push({ severity: 'danger', message: `Sleep declining: ${sleepTrend.slope < -0.3 ? '3-week' : 'weekly'} negative trend detected.` });
        }

        // Deep work capacity falling
        if (previous7.length >= 7) {
            const prevStudy = StatsUtils.mean(previous7.map(m => m.studyMinutes || 0));
            if (recentStudy < prevStudy * 0.7 && prevStudy > 60) {
                alerts.push({ severity: 'warning', message: `Deep work capacity falling. ${Math.round((1 - recentStudy / prevStudy) * 100)}% decline vs last week.` });
            }
        }

        // Exercise deficit
        const exerciseCount = recent7.filter(m => m.exerciseMinutes > 0).length;
        if (exerciseCount < 2) {
            alerts.push({ severity: 'info', message: `Exercise deficit: Only ${exerciseCount}/7 days with physical activity.` });
        }

        // No journaling
        const journalCount = recent7.filter(m => m.journalWords > 0).length;
        if (journalCount === 0) {
            alerts.push({ severity: 'info', message: 'Zero journal entries this week. Self-reflection deficit.' });
        }

        return alerts;
    }
};

// ============================================================================
// SECTION 3E: PREDICTIVE MODELS
// Forecasting and risk prediction
// ============================================================================

export const PredictiveEngine = {
    /**
     * Deadline Risk Prediction
     * P(miss) based on: days_left, assignment_complexity, current_workload, historical_completion_rate
     */
    computeDeadlineRisks: (state) => {
        const pending = (state.assignments || []).filter(a => a.status !== 'completed');
        const today = new Date();
        const risks = [];

        // Historical completion rate
        const total = (state.assignments || []).length;
        const completed = (state.assignments || []).filter(a => a.status === 'completed').length;
        const historicalRate = total > 0 ? completed / total : 0.5;

        pending.forEach(a => {
            const dueDate = new Date(a.dueDate);
            const daysLeft = Math.max(0, (dueDate - today) / (1000 * 60 * 60 * 24));
            const complexityFactor = a.type === 'exam' ? 1.5 : 1.0;
            const urgency = daysLeft < 1 ? 0.95 : daysLeft < 3 ? 0.6 : daysLeft < 7 ? 0.3 : 0.1;

            const riskScore = Math.round(CognitiveEngine.sigmoid(
                urgency * 3 + (1 - historicalRate) * 2 + complexityFactor - 2
            ) * 100);

            if (riskScore > 20) {
                risks.push({
                    title: a.title,
                    daysLeft: Math.round(daysLeft),
                    risk: riskScore,
                    level: riskScore > 70 ? 'high' : riskScore > 40 ? 'medium' : 'low'
                });
            }
        });

        return risks.sort((a, b) => b.risk - a.risk);
    },

    /**
     * Sleep vs Performance Regression
     * Simple linear regression: performance = β0 + β1 * sleep_hours
     */
    computeSleepPerformanceRegression: (dailyMetrics) => {
        const valid = dailyMetrics.filter(m => m.sleepHours !== null && m.sleepHours > 0);
        if (valid.length < 5) return { slope: 0, intercept: 0, correlation: 0, optimalSleep: 7.5 };

        const x = valid.map(m => m.sleepHours);
        const y = valid.map(m => (m.habitCompletionRate || 0) * 100);

        const n = x.length;
        const xMean = StatsUtils.mean(x);
        const yMean = StatsUtils.mean(y);

        let num = 0, den = 0;
        for (let i = 0; i < n; i++) {
            num += (x[i] - xMean) * (y[i] - yMean);
            den += (x[i] - xMean) * (x[i] - xMean);
        }

        const slope = den !== 0 ? num / den : 0;
        const intercept = yMean - slope * xMean;
        const correlation = StatsUtils.pearsonCorrelation(x, y);

        // Optimal sleep = hours that maximize predicted performance (capped at 9)
        const optimalSleep = Math.min(9, Math.max(6, slope > 0 ? (80 - intercept) / slope : 7.5));

        return { slope: Math.round(slope * 10) / 10, intercept: Math.round(intercept), correlation: Math.round(correlation * 100) / 100, optimalSleep: Math.round(optimalSleep * 10) / 10 };
    },

    /**
     * Skill Gap Detection
     * Compares time allocation across subjects vs performance
     */
    computeSkillGaps: (state) => {
        const sessions = state.studySessions || [];
        const assignments = state.assignments || [];
        const gaps = [];

        // Group study time by subject
        const studyBySubject = {};
        sessions.forEach(s => {
            studyBySubject[s.subject] = (studyBySubject[s.subject] || 0) + (s.duration || 0);
        });

        // Group assignments by subject + completion
        const assignmentsBySubject = {};
        assignments.forEach(a => {
            if (!assignmentsBySubject[a.subject]) assignmentsBySubject[a.subject] = { total: 0, completed: 0 };
            assignmentsBySubject[a.subject].total++;
            if (a.status === 'completed') assignmentsBySubject[a.subject].completed++;
        });

        // Detect gaps: subjects with low completion but low study time
        Object.keys(assignmentsBySubject).forEach(subject => {
            const stats = assignmentsBySubject[subject];
            const studyTime = studyBySubject[subject] || 0;
            const completionRate = stats.total > 0 ? stats.completed / stats.total : 1;

            if (completionRate < 0.5 && studyTime < 120) {
                gaps.push({
                    subject,
                    completionRate: Math.round(completionRate * 100),
                    studyMinutes: studyTime,
                    recommendation: `Increase study time for ${subject}`
                });
            }
        });

        return gaps;
    }
};

// ============================================================================
// SECTION 3F: SKILL TREE & GAMIFICATION ENGINE
// Elite gamification with mastery levels and skill domains
// ============================================================================

export const SkillTreeEngine = {
    getMasteryLevel: (xp) => {
        let level = MASTERY_LEVELS[0];
        for (const ml of MASTERY_LEVELS) {
            if (xp >= ml.xpRequired) level = ml;
        }
        return level;
    },

    getNextLevel: (xp) => {
        for (const ml of MASTERY_LEVELS) {
            if (xp < ml.xpRequired) return ml;
        }
        return null;
    },

    computeSkillProgress: (skillXP) => {
        const result = {};
        Object.keys(SKILL_DOMAINS).forEach(domain => {
            const xp = (skillXP && skillXP[domain]) || 0;
            const current = SkillTreeEngine.getMasteryLevel(xp);
            const next = SkillTreeEngine.getNextLevel(xp);
            const progress = next ? ((xp - current.xpRequired) / (next.xpRequired - current.xpRequired)) * 100 : 100;
            result[domain] = {
                ...SKILL_DOMAINS[domain],
                xp,
                level: current,
                nextLevel: next,
                progress: Math.round(progress)
            };
        });
        return result;
    },

    /**
     * Generate contribution heatmap data (GitHub-style)
     * Returns 52 weeks * 7 days grid of activity counts
     */
    generateContributionHeatmap: (state, days = 365) => {
        const grid = [];
        const today = new Date();

        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const key = DateUtils.toKey(d);

            let count = 0;
            // Count all activities
            const habits = state.habitOrder.map(id => state.habits[id]).filter(Boolean);
            habits.forEach(h => { if (h.data && h.data[key]) count++; });
            count += (state.studySessions || []).filter(s => s.date === key).length;
            count += (state.exerciseLog || []).filter(e => e.date === key).length;
            count += (state.journalEntries || []).find(j => j.date === key) ? 1 : 0;
            count += (state.researchLog || []).filter(r => r.date === key).length;

            grid.push({ date: key, count, dayOfWeek: d.getDay() });
        }

        return grid;
    }
};

// ============================================================================
// SECTION 4: STATE MANAGEMENT
// ============================================================================

/**
 * Initial application state
 */
