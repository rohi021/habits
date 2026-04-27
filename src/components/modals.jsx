import React, { useState, useEffect, useMemo, useRef, useCallback, useReducer, createContext, useContext, memo, Suspense, lazy, useId, useSyncExternalStore } from 'react';
import confetti from 'canvas-confetti';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);
import { CONFIG, MOTIVATIONAL_QUOTES, ACHIEVEMENT_DEFS, DAILY_CHALLENGE_POOL } from '../config';
import { DateUtils, StatsUtils, HabitUtils } from '../utils';
import { AnalyticsEngine, CognitiveEngine, ResearchEngine, AccountabilityEngine, PredictiveEngine, SkillTreeEngine } from '../engines';
import { ActionTypes, AppContext } from '../context';
import { IconButton, ProgressRing, Badge, EmptyState, Skeleton, StatCard, HabitItem } from './ui';
import { WellnessAlertsCard, RoutinesSection, CycleTrackingCard, InsightsPanel, StatsOverview, HabitsList, RadarPanel, WeeklyAuditPanel, SkillTreePanel, NotificationPanel } from './panels';
import { SKILL_DOMAINS, MASTERY_LEVELS, createInitialState, appReducer, usePersistedState, useLoadState, useKeyboardShortcuts, useOnlineStatus, showToast, haptic, useApp, InsightCard, generateWellnessAlerts, MatrixView, AnalyticsView, SettingsView, DashboardPage, StudyView, JournalView, ExpenseView, CognitiveLoadBar, MetricCard, MiniHeatmap, GradeTrackerView, CalendarView, GoalView, rootElement, deferredPrompt } from './views';
import { AccountabilityConsole, CommandDashboard, App } from './app';

export const FocusTimer = memo(({ habitId, onClose, onComplete }) => {
    const { state, dispatch } = useApp();
    const habit = state.habits[habitId];
    const [elapsed, setElapsed] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [duration, setDuration] = useState(25 * 60); // 25 minutes
    const intervalRef = useRef(null);
    
    useEffect(() => {
        if (isRunning) {
            intervalRef.current = setInterval(() => {
                setElapsed(prev => {
                    if (prev >= duration) {
                        clearInterval(intervalRef.current);
                        setIsRunning(false);
                        onComplete?.(habitId);
                        showToast('Focus session complete! 🎉', 'success');
                        haptic('heavy');
                        return duration;
                    }
                    return prev + 1;
                });
            }, 1000);
        }
        
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isRunning, duration, habitId, onComplete]);
    
    const progress = (elapsed / duration) * 100;
    const remaining = duration - elapsed;
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    
    const colorConfig = CONFIG.COLORS[habit?.color] || CONFIG.COLORS.indigo;
    
    const handleStart = () => {
        setIsRunning(true);
        dispatch({ type: ActionTypes.START_FOCUS, payload: { habitId, duration } });
    };
    
    const handlePause = () => {
        setIsRunning(false);
    };
    
    const handleReset = () => {
        setIsRunning(false);
        setElapsed(0);
    };
    
    const handleClose = () => {
        if (isRunning) {
            if (!confirm('End focus session early?')) return;
        }
        dispatch({ type: ActionTypes.END_FOCUS });
        onClose();
    };
    
    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-sm animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="focus-timer-title"
        >
            <div className="w-full max-w-md p-6 text-center">
                {/* Close button */}
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white transition-colors"
                    aria-label="Close focus timer"
                >
                    <span className="text-2xl">×</span>
                </button>
                
                {/* Habit name */}
                <h2 
                    id="focus-timer-title"
                    className="text-xl font-bold text-white mb-2"
                >
                    {habit?.name || 'Focus Session'}
                </h2>
                <p className="text-slate-400 text-sm mb-8">Deep work mode - minimize distractions</p>
                
                {/* Timer Ring */}
                <div className="flex justify-center mb-8">
                    <ProgressRing 
                        progress={progress} 
                        size={200} 
                        strokeWidth={12}
                        color={colorConfig.bg}
                    >
                        <div className="text-center">
                            <div className="text-4xl font-bold text-white font-mono">
                                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                                {isRunning ? 'FOCUSING' : elapsed > 0 ? 'PAUSED' : 'READY'}
                            </div>
                        </div>
                    </ProgressRing>
                </div>
                
                {/* Duration selector (only when not started) */}
                {elapsed === 0 && !isRunning && (
                    <div className="flex justify-center gap-2 mb-6">
                        {[15, 25, 45, 60].map(mins => (
                            <button
                                key={mins}
                                onClick={() => setDuration(mins * 60)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    duration === mins * 60
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                }`}
                            >
                                {mins}m
                            </button>
                        ))}
                    </div>
                )}
                
                {/* Control buttons */}
                <div className="flex justify-center gap-3">
                    {!isRunning ? (
                        <button
                            onClick={handleStart}
                            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-bold text-lg transition-colors"
                        >
                            {elapsed > 0 ? 'Resume' : 'Start Focus'}
                        </button>
                    ) : (
                        <button
                            onClick={handlePause}
                            className="px-8 py-3 bg-amber-600 hover:bg-amber-500 rounded-xl text-white font-bold text-lg transition-colors"
                        >
                            Pause
                        </button>
                    )}
                    
                    {elapsed > 0 && (
                        <button
                            onClick={handleReset}
                            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-white font-medium transition-colors"
                        >
                            Reset
                        </button>
                    )}
                </div>
                
                {/* Tips */}
                <div className="mt-8 p-4 bg-slate-800/50 rounded-xl text-left">
                    <h4 className="text-sm font-semibold text-slate-300 mb-2">💡 Focus Tips</h4>
                    <ul className="text-xs text-slate-400 space-y-1">
                        <li>• Put your phone on Do Not Disturb</li>
                        <li>• Close unnecessary browser tabs</li>
                        <li>• Take a short break after the session</li>
                    </ul>
                </div>
            </div>
        </div>
    );
});

/**
 * Add/Edit Habit Modal
 */
export const HabitModal = memo(({ habitId = null, onClose }) => {
    const { state, dispatch } = useApp();
    const existingHabit = habitId ? state.habits[habitId] : null;
    
    const [name, setName] = useState(existingHabit?.name || '');
    const [color, setColor] = useState(existingHabit?.color || 'indigo');
    const [category, setCategory] = useState(existingHabit?.category || 'General');
    const [quadrant, setQuadrant] = useState(existingHabit?.quadrant || 'q2');
    const [errors, setErrors] = useState({});
    
    const inputRef = useRef(null);
    const modalId = useId();
    
    useEffect(() => {
        inputRef.current?.focus();
    }, []);
    
    const validate = () => {
        const newErrors = {};
        if (!name.trim()) {
            newErrors.name = 'Habit name is required';
        } else if (name.trim().length < 2) {
            newErrors.name = 'Name must be at least 2 characters';
        } else if (name.trim().length > 50) {
            newErrors.name = 'Name must be less than 50 characters';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };
    
    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (!validate()) return;
        
        if (existingHabit) {
            dispatch({
                type: ActionTypes.UPDATE_HABIT,
                payload: {
                    id: habitId,
                    updates: { name: name.trim(), color, category, quadrant }
                }
            });
            showToast('Habit updated', 'success');
        } else {
            dispatch({
                type: ActionTypes.ADD_HABIT,
                payload: { name: name.trim(), color, category, quadrant }
            });
            showToast('Habit created', 'success');
        }
        
        onClose();
    };
    
    const handleDelete = () => {
        if (confirm(`Delete "${existingHabit.name}"? This cannot be undone.`)) {
            dispatch({ type: ActionTypes.DELETE_HABIT, payload: { id: habitId } });
            showToast('Habit deleted', 'info');
            onClose();
        }
    };
    
    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };
    
    return (
        <div 
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${modalId}-title`}
        >
            <div 
                className="w-full sm:max-w-md bg-slate-900 rounded-t-3xl sm:rounded-2xl p-6 animate-slide-up border border-slate-700"
                role="document"
            >
                {/* Handle for mobile */}
                <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mb-6 sm:hidden" />
                
                <h2 id={`${modalId}-title`} className="text-xl font-bold text-white mb-6">
                    {existingHabit ? 'Edit Habit' : 'New Habit'}
                </h2>
                
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Name Input */}
                    <div>
                        <label htmlFor={`${modalId}-name`} className="block text-sm font-medium text-slate-300 mb-2">
                            Habit Name *
                        </label>
                        <input
                            ref={inputRef}
                            id={`${modalId}-name`}
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Read for 30 minutes"
                            className={`w-full px-4 py-3 bg-slate-800 border rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                                errors.name ? 'border-rose-500' : 'border-slate-700'
                            }`}
                            aria-invalid={errors.name ? 'true' : 'false'}
                            aria-describedby={errors.name ? `${modalId}-name-error` : undefined}
                        />
                        {errors.name && (
                            <p id={`${modalId}-name-error`} className="mt-1 text-sm text-rose-400">
                                {errors.name}
                            </p>
                        )}
                    </div>
                    
                    {/* Category & Quadrant */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label htmlFor={`${modalId}-category`} className="block text-sm font-medium text-slate-300 mb-2">
                                Category
                            </label>
                            <select
                                id={`${modalId}-category`}
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="General">General</option>
                                {CONFIG.CATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                        
                        <div>
                            <label htmlFor={`${modalId}-quadrant`} className="block text-sm font-medium text-slate-300 mb-2">
                                Priority
                            </label>
                            <select
                                id={`${modalId}-quadrant`}
                                value={quadrant}
                                onChange={(e) => setQuadrant(e.target.value)}
                                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                {Object.entries(CONFIG.QUADRANTS).map(([key, q]) => (
                                    <option key={key} value={key}>{q.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    
                    {/* Color Picker */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Color
                        </label>
                        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Select habit color">
                            {Object.entries(CONFIG.COLORS).map(([colorName, colorConfig]) => (
                                <button
                                    key={colorName}
                                    type="button"
                                    onClick={() => setColor(colorName)}
                                    className={`w-10 h-10 rounded-full transition-all touch-target ${
                                        color === colorName 
                                            ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' 
                                            : 'opacity-60 hover:opacity-100'
                                    }`}
                                    style={{ backgroundColor: colorConfig.bg }}
                                    role="radio"
                                    aria-checked={color === colorName}
                                    aria-label={colorName}
                                />
                            ))}
                        </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4">
                        {existingHabit && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="px-4 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl font-medium transition-colors"
                            >
                                Delete
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-medium transition-colors"
                        >
                            {existingHabit ? 'Save' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
});

// --- ORGANISMS (Complex UI sections) ---

// ============================================================================
// WELLNESS ALERT ENGINE (derived, not persisted)
// ============================================================================

export const StudyTimer = memo(({ onClose }) => {
    const { state, dispatch } = useApp();
    const subjectNames = state.subjects.map(s => typeof s === 'string' ? s : s.name);
    const [selectedSubject, setSelectedSubject] = useState(subjectNames[0] || '');
    const [timerMode, setTimerMode] = useState('regular'); // regular or pomodoro
    const [timeElapsed, setTimeElapsed] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [showSubjectManager, setShowSubjectManager] = useState(false);
    const pomodoroDuration = (state.settings.pomodoroStudy || 25) * 60;
    
    // Update selected subject when subjects list changes (e.g. after adding a new subject)
    useEffect(() => {
        if (!selectedSubject && subjectNames.length > 0) {
            setSelectedSubject(subjectNames[0]);
        }
    }, [subjectNames.length]);
    
    useEffect(() => {
        let interval;
        if (isRunning) {
            interval = setInterval(() => {
                if (timerMode === 'pomodoro') {
                    setTimeElapsed(prev => {
                        if (prev <= 1) {
                            setIsRunning(false);
                            if (state.activeStudySession) {
                                dispatch({ type: ActionTypes.END_STUDY_SESSION });
                                showToast(`Pomodoro complete! +${Math.floor(pomodoroDuration / 60 / 5) * 2} XP`, 'success');
                            }
                            setTimeout(() => onClose(), 500);
                            return 0;
                        }
                        return prev - 1;
                    });
                } else {
                    setTimeElapsed(prev => prev + 1);
                }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isRunning]);
    
    const handleStart = () => {
        if (!selectedSubject) {
            showToast('Please add a subject first in Settings', 'error');
            return;
        }
        if (timerMode === 'pomodoro') {
            setTimeElapsed(pomodoroDuration);
        } else {
            setTimeElapsed(0);
        }
        if (!state.activeStudySession) {
            dispatch({
                type: ActionTypes.START_STUDY_SESSION,
                payload: { subject: selectedSubject, type: timerMode }
            });
        }
        setIsRunning(true);
    };
    
    const handleStop = () => {
        setIsRunning(false);
        if (state.activeStudySession) {
            dispatch({ type: ActionTypes.END_STUDY_SESSION });
            const actualElapsed = timerMode === 'pomodoro' ? pomodoroDuration - timeElapsed : timeElapsed;
            showToast(`Study session saved! +${Math.floor(actualElapsed / 60 / 5) * 2} XP`, 'success');
        }
        setTimeElapsed(0);
        onClose();
    };
    
    const formatTime = (seconds) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };
    
    return (
        <>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-md mx-4 bg-slate-900 rounded-2xl p-6 border border-slate-700">
                <h3 className="text-xl font-bold text-white mb-4">Study Timer</h3>
                
                {!isRunning && (
                    <>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-300 mb-2">Subject</label>
                            <select
                                value={selectedSubject}
                                onChange={(e) => setSelectedSubject(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                            >
                                {subjectNames.length === 0 ? (
                                    <option value="">No subjects yet — add your courses below</option>
                                ) : subjectNames.map(subject => (
                                    <option key={subject} value={subject}>{subject}</option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={() => setShowSubjectManager(true)}
                                className="mt-2 w-full py-2 text-sm text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-lg border border-indigo-500/20 transition-colors"
                            >
                                {subjectNames.length === 0 ? '+ Add Your Courses' : '✏️ Manage Subjects'}
                            </button>
                        </div>
                        
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-slate-300 mb-2">Mode</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setTimerMode('regular'); setTimeElapsed(0); }}
                                    className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                                        timerMode === 'regular' ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'
                                    }`}
                                >
                                    Regular
                                </button>
                                <button
                                    onClick={() => { setTimerMode('pomodoro'); setTimeElapsed(pomodoroDuration); }}
                                    className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                                        timerMode === 'pomodoro' ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'
                                    }`}
                                >
                                    Pomodoro
                                </button>
                            </div>
                        </div>
                    </>
                )}
                
                <div className="text-center mb-6">
                    <div className="text-6xl font-mono font-bold text-indigo-400 mb-2">
                        {formatTime(timeElapsed)}
                    </div>
                    <div className="text-slate-400">{selectedSubject}</div>
                </div>
                
                <div className="flex gap-3">
                    {!isRunning ? (
                        <>
                            <button
                                onClick={onClose}
                                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-white font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleStart}
                                className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 rounded-xl text-white font-medium transition-colors"
                            >
                                Start
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => setIsRunning(false)}
                                className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 rounded-xl text-white font-medium transition-colors"
                            >
                                Pause
                            </button>
                            <button
                                onClick={handleStop}
                                className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 rounded-xl text-white font-medium transition-colors"
                            >
                                Stop & Save
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
        {showSubjectManager && (
            <SubjectManagerModal onClose={() => setShowSubjectManager(false)} />
        )}
        </>
    );
});

/**
 * Assignment Form Modal
 */
export const AssignmentModal = memo(({ onClose, assignment = null, defaultType = null }) => {
    const { state, dispatch } = useApp();
    const subjectNames = state.subjects.map(s => typeof s === 'string' ? s : s.name);
    const [title, setTitle] = useState(assignment?.title || '');
    const [subject, setSubject] = useState(assignment?.subject || (subjectNames[0] || ''));
    const [dueDate, setDueDate] = useState(assignment?.dueDate || '');
    const [type, setType] = useState(assignment?.type || defaultType || 'assignment');
    const [priority, setPriority] = useState(assignment?.priority || 'medium');
    const [progress, setProgress] = useState(assignment?.progress || 0);
    const [description, setDescription] = useState(assignment?.description || '');
    const [showSubjectManager, setShowSubjectManager] = useState(false);
    
    // Update selected subject when subjects list changes (e.g. after adding a new subject)
    useEffect(() => {
        if (!subject && subjectNames.length > 0) {
            setSubject(subjectNames[0]);
        }
    }, [subjectNames.length]);
    
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!title.trim() || !dueDate) return;
        
        if (assignment) {
            dispatch({
                type: ActionTypes.UPDATE_ASSIGNMENT,
                payload: {
                    id: assignment.id,
                    updates: { title: title.trim(), subject, dueDate, type, priority, progress, description }
                }
            });
            showToast('Assignment updated', 'success');
        } else {
            dispatch({
                type: ActionTypes.ADD_ASSIGNMENT,
                payload: {
                    title: title.trim(),
                    subject,
                    dueDate,
                    type,
                    priority,
                    progress,
                    description,
                    status: 'pending',
                    prepProgress: 0,
                    subtasks: []
                }
            });
            showToast('Assignment added! +5 XP', 'success');
        }
        onClose();
    };
    
    return (
        <>
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full sm:max-w-md bg-slate-900 rounded-t-3xl sm:rounded-2xl p-6 border border-slate-700">
                <h3 className="text-xl font-bold text-white mb-4">
                    {assignment ? (assignment.type === 'exam' ? 'Edit Exam' : 'Edit Assignment') : (type === 'exam' ? 'New Exam' : 'New Assignment')}
                </h3>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Title *</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g., Math homework chapter 5"
                            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                            required
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Subject</label>
                            <select
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                            >
                                {subjectNames.length === 0 ? (
                                    <option value="">No subjects yet</option>
                                ) : subjectNames.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={() => setShowSubjectManager(true)}
                                className="mt-1 text-xs text-indigo-400 hover:text-indigo-300"
                            >
                                {subjectNames.length === 0 ? '+ Add Courses' : '✏️ Manage'}
                            </button>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Type</label>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                            >
                                <option value="assignment">Assignment</option>
                                <option value="exam">Exam</option>
                            </select>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Due Date *</label>
                            <input
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Priority</label>
                            <select
                                value={priority}
                                onChange={(e) => setPriority(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                            >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                            </select>
                        </div>
                    </div>
                    
                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Add details..."
                            rows={2}
                            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white resize-none"
                        />
                    </div>
                    
                    {/* Progress Slider */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Progress: {progress}%</label>
                        <input
                            type="range"
                            value={progress}
                            onChange={(e) => setProgress(Number(e.target.value))}
                            min="0" max="100" step="5"
                            className="w-full accent-indigo-500"
                        />
                    </div>
                    
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-white font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 rounded-xl text-white font-medium transition-colors"
                        >
                            {assignment ? 'Update' : 'Add'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
        {showSubjectManager && (
            <SubjectManagerModal onClose={() => setShowSubjectManager(false)} />
        )}
        </>
    );
});

/**
 * Timetable Modal - Add/Edit class schedule entries
 */
export const TimetableModal = memo(({ onClose, entry = null }) => {
    const { state, dispatch } = useApp();
    const subjectNames = state.subjects.map(s => typeof s === 'string' ? s : s.name);
    const [subject, setSubject] = useState(entry?.subject || (subjectNames.length > 0 ? subjectNames[0] : ''));
    const [day, setDay] = useState(entry?.day || 'Monday');
    const [startTime, setStartTime] = useState(entry?.startTime || '09:00');
    const [endTime, setEndTime] = useState(entry?.endTime || '10:00');
    const [room, setRoom] = useState(entry?.room || '');
    const [notes, setNotes] = useState(entry?.notes || '');
    const [showSubjectManager, setShowSubjectManager] = useState(false);
    
    // Update selected subject when subjects list changes (e.g. after adding a new subject)
    useEffect(() => {
        if (!subject && subjectNames.length > 0) {
            setSubject(subjectNames[0]);
        }
    }, [subjectNames.length]);
    
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!subject.trim() || !startTime || !endTime) return;
        
        if (entry) {
            dispatch({
                type: ActionTypes.UPDATE_TIMETABLE_ENTRY,
                payload: {
                    id: entry.id,
                    updates: { subject: subject.trim(), day, startTime, endTime, room: room.trim(), notes: notes.trim() }
                }
            });
            showToast('Class updated', 'success');
        } else {
            dispatch({
                type: ActionTypes.ADD_TIMETABLE_ENTRY,
                payload: {
                    subject: subject.trim(),
                    day,
                    startTime,
                    endTime,
                    room: room.trim(),
                    notes: notes.trim()
                }
            });
            showToast('Class added! +5 XP', 'success');
        }
        onClose();
    };
    
    return (
        <>
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full sm:max-w-md bg-slate-900 rounded-t-3xl sm:rounded-2xl p-6 border border-slate-700">
                <h3 className="text-xl font-bold text-white mb-4">
                    {entry ? 'Edit Class' : 'Add Class'}
                </h3>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Subject *</label>
                        <select
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                        >
                            {subjectNames.length === 0 ? (
                                <option value="">No subjects yet — add your courses below</option>
                            ) : subjectNames.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={() => setShowSubjectManager(true)}
                            className="mt-2 w-full py-2 text-sm text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-lg border border-indigo-500/20 transition-colors"
                        >
                            {subjectNames.length === 0 ? '+ Add Your Courses' : '✏️ Manage Subjects'}
                        </button>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Day *</label>
                        <select
                            value={day}
                            onChange={(e) => setDay(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                        >
                            {days.map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Start Time *</label>
                            <input
                                type="time"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">End Time *</label>
                            <input
                                type="time"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                                required
                            />
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Room / Location</label>
                        <input
                            type="text"
                            value={room}
                            onChange={(e) => setRoom(e.target.value)}
                            placeholder="e.g., Room 101, Lab B"
                            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Notes</label>
                        <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Optional notes..."
                            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                        />
                    </div>
                    
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-white font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 rounded-xl text-white font-medium transition-colors"
                        >
                            {entry ? 'Update' : 'Add Class'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
        {showSubjectManager && (
            <SubjectManagerModal onClose={() => setShowSubjectManager(false)} />
        )}
        </>
    );
});

/**
 * Wellness Tracker Modal - Log sleep, water, exercise, mood
 */
export const WellnessModal = memo(({ type, onClose }) => {
    const { state, dispatch } = useApp();
    const today = DateUtils.toKey();
    const [formData, setFormData] = useState(() => {
        if (type === 'sleep') return { bedtime: '', wakeTime: '', quality: 3 };
        if (type === 'water') return { glasses: state.waterLog[today] || 0 };
        if (type === 'exercise') return { type: 'walk', duration: 30, notes: '' };
        if (type === 'mood') return { mood: 'neutral', energy: 3, note: '' };
        return {};
    });
    
    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (type === 'sleep') {
            const bedtime = new Date(`2000-01-01 ${formData.bedtime}`);
            const wakeTime = new Date(`2000-01-01 ${formData.wakeTime}`);
            let hours = (wakeTime - bedtime) / (1000 * 60 * 60);
            if (hours < 0) hours += 24; // Handle overnight sleep
            
            dispatch({
                type: ActionTypes.LOG_SLEEP,
                payload: {
                    bedtime: formData.bedtime,
                    wakeTime: formData.wakeTime,
                    hours: Math.round(hours * 10) / 10,
                    quality: formData.quality
                }
            });
            showToast('Sleep logged! +5 XP', 'success');
        } else if (type === 'water') {
            dispatch({
                type: ActionTypes.LOG_WATER,
                payload: { glasses: formData.glasses }
            });
            showToast('Water intake updated! +1 XP', 'success');
        } else if (type === 'exercise') {
            dispatch({
                type: ActionTypes.LOG_EXERCISE,
                payload: {
                    type: formData.type,
                    duration: formData.duration,
                    notes: formData.notes
                }
            });
            showToast('Exercise logged! +10 XP', 'success');
        } else if (type === 'mood') {
            dispatch({
                type: ActionTypes.LOG_MOOD,
                payload: {
                    mood: formData.mood,
                    energy: formData.energy,
                    note: formData.note
                }
            });
            showToast('Mood logged! +3 XP', 'success');
        }
        
        onClose();
    };
    
    const titles = {
        sleep: '💤 Log Sleep',
        water: '💧 Log Water',
        exercise: '🏃 Log Exercise',
        mood: '😊 Log Mood'
    };
    
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full sm:max-w-md bg-slate-900 rounded-t-3xl sm:rounded-2xl p-6 border border-slate-700">
                <h3 className="text-xl font-bold text-white mb-4">{titles[type]}</h3>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    {type === 'sleep' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Bedtime</label>
                                <input
                                    type="time"
                                    value={formData.bedtime}
                                    onChange={(e) => setFormData({ ...formData, bedtime: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Wake Time</label>
                                <input
                                    type="time"
                                    value={formData.wakeTime}
                                    onChange={(e) => setFormData({ ...formData, wakeTime: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Quality (1-5 stars)</label>
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <button
                                            key={star}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, quality: star })}
                                            className="text-2xl transition-transform hover:scale-110"
                                        >
                                            {star <= formData.quality ? '⭐' : '☆'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                    
                    {type === 'water' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Glasses of Water</label>
                            <input
                                type="number"
                                min="0"
                                max="20"
                                value={formData.glasses}
                                onChange={(e) => setFormData({ ...formData, glasses: parseInt(e.target.value) || 0 })}
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                            />
                            <div className="mt-2 text-xs text-slate-400">Goal: 8 glasses/day</div>
                        </div>
                    )}
                    
                    {type === 'exercise' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Type</label>
                                <select
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                                >
                                    <option value="walk">Walk</option>
                                    <option value="run">Run</option>
                                    <option value="gym">Gym</option>
                                    <option value="yoga">Yoga</option>
                                    <option value="sport">Sport</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Duration (minutes)</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={formData.duration}
                                    onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })}
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Notes (optional)</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white resize-none"
                                    rows="2"
                                />
                            </div>
                        </>
                    )}
                    
                    {type === 'mood' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">How are you feeling?</label>
                                <div className="flex justify-around gap-2">
                                    {Object.entries(CONFIG.MOODS).map(([key, emoji]) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, mood: key })}
                                            className={`text-4xl transition-all ${
                                                formData.mood === key ? 'scale-125' : 'opacity-50 hover:opacity-100'
                                            }`}
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Energy Level (1-5)</label>
                                <input
                                    type="range"
                                    min="1"
                                    max="5"
                                    value={formData.energy}
                                    onChange={(e) => setFormData({ ...formData, energy: parseInt(e.target.value) })}
                                    className="w-full"
                                />
                                <div className="flex justify-between text-xs text-slate-400 mt-1">
                                    <span>Low</span>
                                    <span className="text-white font-medium">{formData.energy}</span>
                                    <span>High</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Note (optional)</label>
                                <textarea
                                    value={formData.note}
                                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white resize-none"
                                    rows="2"
                                    placeholder="How was your day?"
                                />
                            </div>
                        </>
                    )}
                    
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-white font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 rounded-xl text-white font-medium transition-colors"
                        >
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
});

/**
 * Journal Entry Modal
 */
export const JournalEntryModal = memo(({ entry, onClose }) => {
    const { dispatch } = useApp();
    const today = DateUtils.toKey();
    const [content, setContent] = useState(entry?.content || '');
    const [mood, setMood] = useState(entry?.mood || 'neutral');
    const [energy, setEnergy] = useState(entry?.energy || 3);
    const [gratitude, setGratitude] = useState(entry?.gratitude || '');
    
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!content.trim()) return;
        
        if (entry) {
            dispatch({
                type: ActionTypes.UPDATE_JOURNAL_ENTRY,
                payload: {
                    id: entry.id,
                    updates: { content: content.trim(), mood, energy, gratitude: gratitude.trim() }
                }
            });
            showToast('Journal updated', 'success');
        } else {
            dispatch({
                type: ActionTypes.ADD_JOURNAL_ENTRY,
                payload: {
                    content: content.trim(),
                    mood,
                    energy,
                    gratitude: gratitude.trim()
                }
            });
            showToast('Journal entry saved! +10 XP', 'success');
        }
        onClose();
    };
    
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full sm:max-w-lg bg-slate-900 rounded-t-3xl sm:rounded-2xl p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
                <h3 className="text-xl font-bold text-white mb-4">
                    {entry ? 'Edit Entry' : '✍️ New Journal Entry'}
                </h3>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">How was your day?</label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Write about your day, thoughts, and feelings..."
                            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white resize-none"
                            rows="6"
                            required
                        />
                        <div className="mt-1 text-xs text-slate-400">
                            {content.trim().split(/\s+/).filter(w => w).length} words
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Mood</label>
                        <div className="flex justify-around gap-2">
                            {Object.entries(CONFIG.MOODS).map(([key, emoji]) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setMood(key)}
                                    className={`text-3xl transition-all ${
                                        mood === key ? 'scale-125' : 'opacity-50 hover:opacity-100'
                                    }`}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Energy Level</label>
                        <input
                            type="range"
                            min="1"
                            max="5"
                            value={energy}
                            onChange={(e) => setEnergy(parseInt(e.target.value))}
                            className="w-full"
                        />
                        <div className="flex justify-between text-xs text-slate-400 mt-1">
                            <span>Low</span>
                            <span className="text-white font-medium">{energy}</span>
                            <span>High</span>
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Gratitude (optional)</label>
                        <input
                            type="text"
                            value={gratitude}
                            onChange={(e) => setGratitude(e.target.value)}
                            placeholder="What are you grateful for today?"
                            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                        />
                    </div>
                    
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-white font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 rounded-xl text-white font-medium transition-colors"
                        >
                            {entry ? 'Update' : 'Save Entry'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
});

// --- TEMPLATES (Full page layouts) ---

/**
 * Eisenhower Matrix View
 */
export const ExpenseModal = memo(({ expense, onClose }) => {
    const { state, dispatch } = useApp();
    const [amount, setAmount] = useState(expense?.amount || '');
    const [category, setCategory] = useState(expense?.category || state.expenseCategories[0]);
    const [description, setDescription] = useState(expense?.description || '');
    const [date, setDate] = useState(expense?.date || DateUtils.toKey());
    
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!amount || parseFloat(amount) <= 0) return;
        
        if (expense) {
            dispatch({
                type: ActionTypes.UPDATE_EXPENSE,
                payload: {
                    id: expense.id,
                    updates: {
                        amount: parseFloat(amount),
                        category,
                        description: description.trim(),
                        date
                    }
                }
            });
            showToast('Expense updated', 'success');
        } else {
            dispatch({
                type: ActionTypes.ADD_EXPENSE,
                payload: {
                    amount: parseFloat(amount),
                    category,
                    description: description.trim(),
                    date
                }
            });
            showToast('Expense tracked! +2 XP', 'success');
        }
        onClose();
    };
    
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full sm:max-w-md bg-slate-900 rounded-t-3xl sm:rounded-2xl p-6 border border-slate-700">
                <h3 className="text-xl font-bold text-white mb-4">
                    {expense ? 'Edit Expense' : '💰 Add Expense'}
                </h3>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Amount *</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">{state.settings.currency}</span>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                className="w-full pl-8 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                                required
                            />
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Category</label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                        >
                            {state.expenseCategories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="e.g., Lunch at cafeteria"
                            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Date</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white"
                        />
                    </div>
                    
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-white font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 rounded-xl text-white font-medium transition-colors"
                        >
                            {expense ? 'Update' : 'Add'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
});

/**
 * Expense Tracker View
 */
export const ResearchModal = memo(({ onClose }) => {
    const { dispatch } = useApp();
    const [type, setType] = useState('paper');
    const [title, setTitle] = useState('');
    const [notes, setNotes] = useState('');
    const [duration, setDuration] = useState('');
    const [domain, setDomain] = useState('research');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        dispatch({
            type: ActionTypes.ADD_RESEARCH_ENTRY,
            payload: { type, title: title.trim(), notes, duration: parseInt(duration) || 0, domain }
        });
        showToast('Research entry logged', 'success');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-white mb-4 font-mono">Log Research Activity</h3>
                <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                        <label className="text-xs text-slate-400 font-mono mb-1 block">Type</label>
                        <select value={type} onChange={e => setType(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
                            <option value="paper">Paper Read</option>
                            <option value="experiment">Experiment Run</option>
                            <option value="model">Model Trained</option>
                            <option value="deployment">Deployment</option>
                            <option value="insight">Research Insight</option>
                            <option value="bugfix">Bug Fixed</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 font-mono mb-1 block">Title</label>
                        <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                            placeholder="What did you work on?" required />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 font-mono mb-1 block">Skill Domain</label>
                        <select value={domain} onChange={e => setDomain(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
                            {Object.entries(SKILL_DOMAINS).map(([key, d]) => (
                                <option key={key} value={key}>{d.icon} {d.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 font-mono mb-1 block">Duration (minutes)</label>
                        <input type="number" value={duration} onChange={e => setDuration(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                            placeholder="0" min="0" />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 font-mono mb-1 block">Notes</label>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white h-20 resize-none"
                            placeholder="Key findings, observations..." />
                    </div>
                    <div className="flex gap-2 pt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors">
                            Cancel
                        </button>
                        <button type="submit"
                            className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors">
                            Log Entry
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
});

/**
 * Command Dashboard — Main Cognitive Command Center View
 * Analytical aesthetic, information dense, priority-based hierarchy
 */
export const SubjectManagerModal = memo(({ onClose }) => {
    const { state, dispatch } = useApp();
    const [name, setName] = useState('');
    const [color, setColor] = useState('indigo');
    const [icon, setIcon] = useState('📘');
    const [weeklyGoalHours, setWeeklyGoalHours] = useState(5);
    const [editingId, setEditingId] = useState(null);
    
    const colors = Object.keys(CONFIG.COLORS);
    const icons = ['📘', '📗', '📕', '📙', '📓', '🔬', '🧮', '🎨', '🌍', '💻', '📐', '🎵', '⚗️', '📊', '🏛️', '✏️'];
    
    const handleSave = () => {
        if (!name.trim()) return;
        if (editingId) {
            dispatch({ type: ActionTypes.UPDATE_SUBJECT, payload: { id: editingId, name: name.trim(), color, icon, weeklyGoalHours } });
        } else {
            dispatch({ type: ActionTypes.ADD_SUBJECT, payload: { id: crypto.randomUUID(), name: name.trim(), color, icon, weeklyGoalHours } });
        }
        setName(''); setColor('indigo'); setIcon('📘'); setWeeklyGoalHours(5); setEditingId(null);
        showToast(editingId ? 'Subject updated' : 'Subject added', 'success');
    };
    
    const handleEdit = (subject) => {
        setName(subject.name);
        setColor(subject.color || 'indigo');
        setIcon(subject.icon || '📘');
        setWeeklyGoalHours(subject.weeklyGoalHours || 5);
        setEditingId(subject.id);
    };
    
    const handleDelete = (id) => {
        if (confirm('Delete this subject? It may affect linked assignments and exams.')) {
            dispatch({ type: ActionTypes.DELETE_SUBJECT, payload: { id } });
            showToast('Subject deleted');
        }
    };
    
    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose} role="dialog" aria-modal="true" aria-label="Manage Subjects">
            <div className="w-full max-w-lg bg-slate-900 rounded-t-2xl p-6 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white">Manage Subjects</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-xl" aria-label="Close">✕</button>
                </div>
                
                {/* Add/Edit Form */}
                <div className="space-y-3 mb-4 p-3 bg-slate-800/50 rounded-xl border border-slate-700">
                    <input
                        type="text" value={name} onChange={e => setName(e.target.value)}
                        placeholder="Subject name" maxLength={50}
                        className="w-full px-3 py-2 bg-slate-800 rounded-lg border border-slate-600 text-white text-sm"
                    />
                    <div className="flex gap-2 flex-wrap">
                        {icons.map(ic => (
                            <button key={ic} onClick={() => setIcon(ic)}
                                className={`text-xl p-1 rounded ${icon === ic ? 'bg-indigo-500' : 'bg-slate-700'}`}>{ic}</button>
                        ))}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {colors.map(c => (
                            <button key={c} onClick={() => setColor(c)}
                                className={`w-6 h-6 rounded-full border-2 ${color === c ? 'border-white' : 'border-transparent'}`}
                                style={{ backgroundColor: CONFIG.COLORS[c]?.bg }} aria-label={c} />
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-slate-400">Weekly Goal (hrs):</label>
                        <input type="number" value={weeklyGoalHours} onChange={e => setWeeklyGoalHours(Math.max(0, Number(e.target.value)))}
                            min="0" max="100" className="w-16 px-2 py-1 bg-slate-800 rounded border border-slate-600 text-white text-sm" />
                    </div>
                    <button onClick={handleSave} className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium text-sm">
                        {editingId ? 'Update Subject' : 'Add Subject'}
                    </button>
                </div>
                
                {/* Subject List */}
                {state.subjects.length === 0 ? (
                    <div className="text-center py-6 text-slate-400">
                        <div className="text-3xl mb-2">📚</div>
                        <p className="text-sm">No subjects yet. Add your first subject above!</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {state.subjects.map(subject => (
                            <div key={subject.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">{subject.icon || '📘'}</span>
                                    <span className="font-medium text-white text-sm">{subject.name}</span>
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CONFIG.COLORS[subject.color]?.bg || '#6366f1' }} />
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleEdit(subject)} className="text-slate-400 hover:text-white text-sm" aria-label="Edit">✏️</button>
                                    <button onClick={() => handleDelete(subject.id)} className="text-slate-400 hover:text-rose-400 text-sm" aria-label="Delete">🗑️</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
});

// ============================================================================
// SECTION 8C: GRADE TRACKER VIEW
// ============================================================================

