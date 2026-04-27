import React, { useState, useEffect, useMemo, useRef, useCallback, useReducer, createContext, useContext, memo, Suspense, lazy, useId, useSyncExternalStore } from 'react';
import confetti from 'canvas-confetti';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);
import { CONFIG, MOTIVATIONAL_QUOTES, ACHIEVEMENT_DEFS, DAILY_CHALLENGE_POOL } from '../config';
import { DateUtils, StatsUtils, HabitUtils } from '../utils';
import { AnalyticsEngine, CognitiveEngine, ResearchEngine, AccountabilityEngine, PredictiveEngine, SkillTreeEngine } from '../engines';
import { ActionTypes, AppContext } from '../context';
import { FocusTimer, HabitModal, StudyTimer, AssignmentModal, TimetableModal, WellnessModal, JournalEntryModal, ExpenseModal, ResearchModal, SubjectManagerModal } from './modals';
import { WellnessAlertsCard, RoutinesSection, CycleTrackingCard, InsightsPanel, StatsOverview, HabitsList, RadarPanel, WeeklyAuditPanel, SkillTreePanel, NotificationPanel } from './panels';
import { SKILL_DOMAINS, MASTERY_LEVELS, createInitialState, appReducer, usePersistedState, useLoadState, useKeyboardShortcuts, useOnlineStatus, showToast, haptic, useApp, InsightCard, generateWellnessAlerts, MatrixView, AnalyticsView, SettingsView, DashboardPage, StudyView, JournalView, ExpenseView, CognitiveLoadBar, MetricCard, MiniHeatmap, GradeTrackerView, CalendarView, GoalView, rootElement, deferredPrompt } from './views';
import { AccountabilityConsole, CommandDashboard, App } from './app';

export const IconButton = memo(({ 
    icon, 
    label, 
    onClick, 
    className = '', 
    disabled = false,
    size = 'md'
}) => {
    const sizeClasses = {
        sm: 'w-8 h-8',
        md: 'w-10 h-10',
        lg: 'w-12 h-12'
    };
    
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            title={label}
            className={`touch-target rounded-lg flex items-center justify-center transition-all
                ${sizeClasses[size]}
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-700/50 active:scale-95'}
                ${className}`}
        >
            <span className="text-xl" role="img" aria-hidden="true">{icon}</span>
        </button>
    );
});

/**
 * Progress ring component
 */
export const ProgressRing = memo(({ progress, size = 120, strokeWidth = 8, color = '#6366f1', children }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;
    
    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="transform -rotate-90">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth={strokeWidth}
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    className="progress-ring-circle"
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                {children}
            </div>
        </div>
    );
});

/**
 * Badge component
 */
export const Badge = memo(({ children, variant = 'default', className = '' }) => {
    const variants = {
        default: 'bg-slate-700 text-slate-200',
        success: 'bg-emerald-500/20 text-emerald-400',
        warning: 'bg-amber-500/20 text-amber-400',
        danger: 'bg-rose-500/20 text-rose-400',
        info: 'bg-sky-500/20 text-sky-400'
    };
    
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}>
            {children}
        </span>
    );
});

/**
 * Empty state component
 */
export const EmptyState = memo(({ icon, title, description, action }) => (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
            <span className="text-3xl">{icon}</span>
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-slate-400 text-sm mb-6 max-w-xs">{description}</p>
        {action}
    </div>
));

/**
 * Loading skeleton
 */
export const Skeleton = memo(({ className = '' }) => (
    <div className={`skeleton rounded-lg ${className}`} />
));

// --- MOLECULES (Combinations of atoms) ---

/**
 * Insight card component
 */
export const StatCard = memo(({ icon, label, value, subvalue, color = 'indigo' }) => (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">{label}</span>
            <span className="text-lg">{icon}</span>
        </div>
        <div className="text-2xl font-bold text-white">{value}</div>
        {subvalue && <div className="text-xs text-slate-500 mt-1">{subvalue}</div>}
    </div>
));

    /**
 * Habit item component with full accessibility
 */
export const HabitItem = memo(({ habit, onToggle, onEdit, onStartFocus }) => {
    const todayKey = DateUtils.toKey();
    const isCompleted = !!habit.data?.[todayKey];
    const streak = HabitUtils.calculateStreak(habit.data);
    const completionRate = HabitUtils.calculateCompletionRate(habit.data, 7);
    const colorConfig = CONFIG.COLORS[habit.color] || CONFIG.COLORS.indigo;
    
    const handleToggle = useCallback(() => {
        haptic('medium');
        onToggle(habit.id);
    }, [habit.id, onToggle]);
    
    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle();
        }
    }, [handleToggle]);
    
    return (
        <div 
            className={`habit-card group relative bg-slate-800/80 rounded-xl p-4 border-2 transition-all duration-200 ${
                isCompleted 
                    ? 'border-emerald-500/50 bg-emerald-500/5' 
                    : 'border-slate-700 hover:border-slate-600'
            }`}
            role="listitem"
            aria-label={`${habit.name}, ${isCompleted ? 'completed' : 'not completed'}, ${streak} day streak`}
        >
            <div className="flex items-center gap-4">
                {/* Completion Toggle Button */}
                <button
                    onClick={handleToggle}
                    onKeyDown={handleKeyDown}
                    className={`touch-target w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
                        isCompleted 
                            ? 'text-white shadow-lg scale-100' 
                            : 'bg-slate-700 text-slate-500 hover:bg-slate-600 scale-95 hover:scale-100'
                    }`}
                    style={isCompleted ? { 
                        background: `linear-gradient(135deg, ${colorConfig.bg}, ${colorConfig.dark})`,
                        boxShadow: `0 4px 15px ${colorConfig.bg}40`
                    } : {}}
                    aria-pressed={isCompleted}
                    aria-label={`Mark ${habit.name} as ${isCompleted ? 'incomplete' : 'complete'}`}
                >
                    {isCompleted ? (
                        <span className="text-xl">✓</span>
                    ) : (
                        <div className="w-6 h-6 rounded-md border-2 border-slate-500" />
                    )}
                </button>
                
                {/* Habit Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`font-semibold text-white truncate ${isCompleted ? 'line-through opacity-60' : ''}`}>
                            {habit.name}
                        </h3>
                        {habit.quadrant === 'q1' && (
                            <Badge variant="danger">Urgent</Badge>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {/* Streak */}
                        {streak > 0 && (
                            <span className={`flex items-center gap-1 text-xs font-medium ${
                                streak >= 7 ? 'text-amber-400' : 'text-slate-400'
                            }`}>
                                <span className={streak >= 7 ? 'animate-pulse' : ''}>🔥</span>
                                {streak} day{streak !== 1 ? 's' : ''}
                            </span>
                        )}
                        
                        {/* Category */}
                        <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded">
                            {habit.category}
                        </span>
                        
                        {/* Weekly rate */}
                        <span className={`text-xs font-medium ${
                            completionRate >= 80 ? 'text-emerald-400' : 
                            completionRate >= 50 ? 'text-amber-400' : 'text-slate-400'
                        }`}>
                            {completionRate}% this week
                        </span>
                    </div>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <IconButton 
                        icon="⏱️" 
                        label={`Start focus session for ${habit.name}`}
                        onClick={() => onStartFocus(habit.id)}
                        size="sm"
                    />
                    <IconButton 
                        icon="✏️" 
                        label={`Edit ${habit.name}`}
                        onClick={() => onEdit(habit.id)}
                        size="sm"
                    />
                </div>
            </div>
            
            {/* Mini heatmap (last 7 days) */}
            <div className="flex gap-1 mt-3 pt-3 border-t border-slate-700/50">
                {Array.from({ length: 7 }, (_, i) => {
                    const date = DateUtils.daysAgo(6 - i);
                    const key = DateUtils.toKey(date);
                    const completed = habit.data?.[key];
                    const dayName = date.toLocaleDateString('en-US', { weekday: 'narrow' });
                    
                    return (
                        <div key={i} className="flex flex-col items-center gap-1 flex-1">
                            <span className="text-[10px] text-slate-500">{dayName}</span>
                            <div 
                                className={`w-full aspect-square max-w-[24px] rounded-sm transition-colors ${
                                    completed 
                                        ? '' 
                                        : 'bg-slate-700/50'
                                }`}
                                style={completed ? { backgroundColor: colorConfig.bg } : {}}
                                title={`${DateUtils.format(date)}: ${completed ? 'Completed' : 'Missed'}`}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
});

/**
 * Focus Timer Modal
 */
