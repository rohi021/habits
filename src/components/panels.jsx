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
import { SKILL_DOMAINS, MASTERY_LEVELS, createInitialState, appReducer, usePersistedState, useLoadState, useKeyboardShortcuts, useOnlineStatus, showToast, haptic, useApp, InsightCard, generateWellnessAlerts, MatrixView, AnalyticsView, SettingsView, DashboardPage, StudyView, JournalView, ExpenseView, CognitiveLoadBar, MetricCard, MiniHeatmap, GradeTrackerView, CalendarView, GoalView, rootElement, deferredPrompt } from './views';
import { AccountabilityConsole, CommandDashboard, App } from './app';

export const WellnessAlertsCard = memo(() => {
    const { state, dispatch } = useApp();
    
    const alerts = useMemo(() => generateWellnessAlerts(state), [
        state.sleepLog, state.studySessions, state.moodLog, 
        state.wellnessInsights, state.settings, state.sleepGoal
    ]);
    
    if (alerts.length === 0) return null;
    
    const severityColors = {
        critical: 'from-rose-500/20 to-red-500/20 border-rose-500/30',
        warning: 'from-amber-500/20 to-orange-500/20 border-amber-500/30',
        info: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30'
    };
    const severityIcons = { critical: '🚨', warning: '⚠️', info: 'ℹ️' };
    
    return (
        <section className="mb-6" aria-labelledby="wellness-alerts-heading">
            <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🩺</span>
                <h3 id="wellness-alerts-heading" className="font-bold text-white text-sm">Wellness Insights</h3>
                <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">{alerts.length}</span>
            </div>
            <div className="space-y-2">
                {alerts.map(alert => (
                    <div key={alert.id} className={`bg-gradient-to-r ${severityColors[alert.severity]} rounded-xl p-3 border`}>
                        <div className="flex items-start gap-2">
                            <span className="text-sm mt-0.5">{severityIcons[alert.severity]}</span>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-white">{alert.title}</div>
                                <div className="text-xs text-slate-300 mt-1">{alert.message}</div>
                                <div className="flex items-center gap-2 mt-2">
                                    {alert.actionLink && (
                                        <button
                                            onClick={() => dispatch({ type: ActionTypes.SET_VIEW, payload: alert.actionLink.view })}
                                            className="text-xs px-2 py-1 bg-white/10 text-white rounded hover:bg-white/20 transition-colors"
                                            aria-label={`Go to ${alert.actionLink.view}`}
                                        >
                                            View →
                                        </button>
                                    )}
                                    <button
                                        onClick={() => dispatch({ type: ActionTypes.DISMISS_INSIGHT_ALERT, payload: { alertId: alert.id } })}
                                        className="text-xs px-2 py-1 text-slate-400 hover:text-slate-300 transition-colors"
                                        aria-label="Dismiss alert"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
});

// ============================================================================
// ROUTINE BUILDER
// ============================================================================

export const RoutinesSection = memo(() => {
    const { state, dispatch } = useApp();
    const [showEditor, setShowEditor] = useState(false);
    const [editingRoutine, setEditingRoutine] = useState(null);
    const [editorName, setEditorName] = useState('');
    const [editorIcon, setEditorIcon] = useState('☀️');
    const [editorHabitIds, setEditorHabitIds] = useState([]);
    
    const todayKey = DateUtils.toKey();
    const routines = state.routines?.items || [];
    const activeHabits = useMemo(() => 
        state.habitOrder.map(id => ({ ...state.habits[id], _hid: id })).filter(h => h && !h.archived),
        [state.habits, state.habitOrder]
    );
    
    const openEditor = useCallback((routine) => {
        if (routine) {
            setEditingRoutine(routine);
            setEditorName(routine.name);
            setEditorIcon(routine.icon);
            setEditorHabitIds([...routine.habitIds]);
        } else {
            setEditingRoutine(null);
            setEditorName('');
            setEditorIcon('☀️');
            setEditorHabitIds([]);
        }
        setShowEditor(true);
    }, []);
    
    const saveRoutine = useCallback(() => {
        if (!editorName.trim()) return;
        if (editingRoutine) {
            dispatch({ type: ActionTypes.UPDATE_ROUTINE, payload: { id: editingRoutine.id, name: editorName, icon: editorIcon, habitIds: editorHabitIds } });
        } else {
            dispatch({ type: ActionTypes.ADD_ROUTINE, payload: { name: editorName, icon: editorIcon, habitIds: editorHabitIds } });
        }
        setShowEditor(false);
    }, [editorName, editorIcon, editorHabitIds, editingRoutine, dispatch]);
    
    const toggleHabitInRoutine = useCallback((hid) => {
        setEditorHabitIds(prev => prev.includes(hid) ? prev.filter(id => id !== hid) : [...prev, hid]);
    }, []);
    
    if (routines.length === 0 && !showEditor) {
        return (
            <section className="mb-6">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">🔄</span>
                        <h3 className="font-bold text-white text-sm">Routines</h3>
                    </div>
                    <button onClick={() => openEditor(null)} className="text-xs text-indigo-400 hover:text-indigo-300" aria-label="Add routine">+ Add</button>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
                    <div className="text-2xl mb-2">🌅</div>
                    <div className="text-sm text-slate-400">Create a morning or evening routine to complete habits with one tap</div>
                </div>
            </section>
        );
    }
    
    return (
        <section className="mb-6">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className="text-lg">🔄</span>
                    <h3 className="font-bold text-white text-sm">Routines</h3>
                </div>
                <button onClick={() => openEditor(null)} className="text-xs text-indigo-400 hover:text-indigo-300" aria-label="Add routine">+ Add</button>
            </div>
            
            <div className="space-y-2">
                {routines.map(routine => {
                    const completed = routine.habitIds.filter(hid => state.habits[hid]?.data?.[todayKey]).length;
                    const total = routine.habitIds.length;
                    const allDone = total > 0 && completed === total;
                    const routineCompletion = state.routines?.completions?.[todayKey]?.[routine.id];
                    
                    return (
                        <div key={routine.id} className={`rounded-xl p-3 border transition-all ${allDone ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-800/50 border-slate-700'}`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">{routine.icon}</span>
                                    <div>
                                        <div className="text-sm font-medium text-white">{routine.name}</div>
                                        <div className="text-xs text-slate-400">{completed}/{total} habits done</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {!allDone && total > 0 && (
                                        <button
                                            onClick={() => {
                                                dispatch({ type: ActionTypes.COMPLETE_ROUTINE_TODAY, payload: { routineId: routine.id } });
                                                showToast(`${routine.name} completed! 🎉`, 'success');
                                            }}
                                            className="text-xs px-3 py-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
                                            aria-label={`Complete ${routine.name}`}
                                        >
                                            Complete All
                                        </button>
                                    )}
                                    {allDone && <span className="text-xs text-emerald-400 font-medium">✓ Done</span>}
                                    <button onClick={() => openEditor(routine)} className="text-slate-400 hover:text-white p-1" aria-label={`Edit ${routine.name}`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" /></svg>
                                    </button>
                                </div>
                            </div>
                            {total > 0 && (
                                <div className="mt-2 w-full bg-slate-700 rounded-full h-1.5">
                                    <div className={`h-1.5 rounded-full transition-all ${allDone ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${(completed / total) * 100}%` }} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            
            {/* Routine Editor Bottom Sheet */}
            {showEditor && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" onClick={() => setShowEditor(false)}>
                    <div className="bg-slate-800 rounded-t-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-4" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-1 bg-slate-600 rounded-full mx-auto mb-4" />
                        <h3 className="font-bold text-white text-lg mb-4">{editingRoutine ? 'Edit Routine' : 'New Routine'}</h3>
                        
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Name</label>
                                <input value={editorName} onChange={e => setEditorName(e.target.value)} placeholder="e.g., Morning Routine"
                                    className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Icon</label>
                                <div className="flex gap-2 flex-wrap">
                                    {['☀️', '🌙', '💪', '🧘', '📚', '🏃', '☕', '🌿'].map(icon => (
                                        <button key={icon} onClick={() => setEditorIcon(icon)}
                                            className={`text-xl p-2 rounded-lg ${editorIcon === icon ? 'bg-indigo-500/30 ring-2 ring-indigo-500' : 'bg-slate-700'}`}>{icon}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Habits ({editorHabitIds.length} selected)</label>
                                <div className="space-y-1 max-h-48 overflow-y-auto">
                                    {activeHabits.map(h => {
                                        const hid = h._hid;
                                        const selected = editorHabitIds.includes(hid);
                                        return (
                                        <button key={hid} 
                                            onClick={() => toggleHabitInRoutine(hid)}
                                            className={`w-full flex items-center gap-2 p-2 rounded-lg text-left text-sm transition-colors ${
                                                selected ? 'bg-indigo-500/20 text-white' : 'bg-slate-700/50 text-slate-300'
                                            }`}>
                                            <span>{h.icon || '📌'}</span>
                                            <span>{h.name}</span>
                                            {selected && <span className="ml-auto text-indigo-400">✓</span>}
                                        </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex gap-2 mt-4">
                            {editingRoutine && (
                                <button onClick={() => { dispatch({ type: ActionTypes.DELETE_ROUTINE, payload: { id: editingRoutine.id } }); setShowEditor(false); }}
                                    className="px-4 py-2 text-rose-400 text-sm hover:bg-rose-500/10 rounded-lg" aria-label="Delete routine">Delete</button>
                            )}
                            <div className="flex-1" />
                            <button onClick={() => setShowEditor(false)} className="px-4 py-2 text-slate-400 text-sm">Cancel</button>
                            <button onClick={saveRoutine} className="px-4 py-2 bg-indigo-500 text-white text-sm rounded-lg hover:bg-indigo-600">Save</button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
});

// ============================================================================
// CYCLE TRACKING (Optional)
// ============================================================================

export const CycleTrackingCard = memo(() => {
    const { state, dispatch } = useApp();
    const [showLog, setShowLog] = useState(false);
    const [startDate, setStartDate] = useState(DateUtils.toKey());
    const [flow, setFlow] = useState('medium');
    
    if (!state.cycle?.enabled) return null;
    
    const periods = state.cycle?.periods || [];
    const lastPeriod = periods.length > 0 ? periods[periods.length - 1] : null;
    const cycleLen = state.cycle?.settings?.averageCycleLength || 28;
    const periodLen = state.cycle?.settings?.averagePeriodLength || 5;
    
    // Estimate current cycle day and next period
    let cycleDay = null;
    let nextPeriodDate = null;
    let currentPhase = '';
    
    if (lastPeriod) {
        const lastStart = DateUtils.parseKey(lastPeriod.startDate);
        const today = new Date();
        const daysSinceStart = Math.round((today - lastStart) / 86400000);
        cycleDay = (daysSinceStart % cycleLen) + 1;
        
        const nextDate = DateUtils.addDays(lastStart, cycleLen * Math.max(1, Math.ceil((daysSinceStart + 1) / cycleLen)));
        nextPeriodDate = nextDate;
        
        // Dynamic phase estimation based on user settings
        const lutealLen = state.cycle?.settings?.lutealLength || 14;
        const ovulationDay = cycleLen - lutealLen;
        if (cycleDay <= periodLen) currentPhase = 'Menstrual';
        else if (cycleDay < ovulationDay - 1) currentPhase = 'Follicular';
        else if (cycleDay <= ovulationDay + 1) currentPhase = 'Ovulation';
        else currentPhase = 'Luteal';
    }
    
    return (
        <div className="bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-xl p-4 border border-pink-500/20 mb-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className="text-lg">🌸</span>
                    <h3 className="font-bold text-white text-sm">Cycle Tracker</h3>
                </div>
                <button onClick={() => setShowLog(!showLog)} className="text-xs text-pink-400 hover:text-pink-300">
                    {showLog ? 'Close' : '+ Log'}
                </button>
            </div>
            
            {cycleDay !== null ? (
                <div className="grid grid-cols-3 gap-2 mb-2">
                    <div className="text-center">
                        <div className="text-lg font-bold text-pink-400">Day {cycleDay}</div>
                        <div className="text-[10px] text-slate-400">Cycle Day</div>
                    </div>
                    <div className="text-center">
                        <div className="text-sm font-semibold text-purple-400">{currentPhase}</div>
                        <div className="text-[10px] text-slate-400">Phase</div>
                    </div>
                    <div className="text-center">
                        <div className="text-sm font-semibold text-slate-300">{nextPeriodDate ? (() => { const d = nextPeriodDate instanceof Date ? nextPeriodDate : DateUtils.parseKey(nextPeriodDate); const diff = Math.round((d - new Date()) / 86400000); return diff <= 0 ? 'Any day' : diff <= 7 ? `in ${diff}d` : d.toLocaleDateString('en', { month: 'short', day: 'numeric' }); })() : '—'}</div>
                        <div className="text-[10px] text-slate-400">Next (est.)</div>
                    </div>
                </div>
            ) : (
                <div className="text-xs text-slate-400 mb-2">Log your first period to start tracking.</div>
            )}
            
            <div className="text-[10px] text-slate-500 italic">All data is stored locally only. Dates are estimates.</div>
            
            {showLog && (
                <div className="mt-3 space-y-2 border-t border-slate-700 pt-3">
                    <div>
                        <label htmlFor="period-start-date" className="text-xs text-slate-400">Period start date</label>
                        <input id="period-start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                            className="w-full bg-slate-700 text-white rounded-lg px-3 py-1.5 text-sm mt-1" />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400">Flow</label>
                        <div className="flex gap-2 mt-1">
                            {['light', 'medium', 'heavy'].map(f => (
                                <button key={f} onClick={() => setFlow(f)}
                                    className={`text-xs px-3 py-1 rounded-lg capitalize ${flow === f ? 'bg-pink-500/30 text-pink-300' : 'bg-slate-700 text-slate-400'}`}>{f}</button>
                            ))}
                        </div>
                    </div>
                    <button onClick={() => { dispatch({ type: ActionTypes.LOG_PERIOD, payload: { startDate, flow } }); setShowLog(false); showToast('Period logged'); }}
                        className="w-full py-2 bg-pink-500 text-white text-sm rounded-lg hover:bg-pink-600 transition-colors">Log Period</button>
                </div>
            )}
        </div>
    );
});

/**
 * Insights Panel with real AI-generated insights
 */
export const InsightsPanel = memo(() => {
    const { state } = useApp();
    
    const insights = useMemo(() => 
        AnalyticsEngine.generateInsights(state.habits, state.habitOrder),
        [state.habits, state.habitOrder]
    );
    
    if (insights.length === 0) return null;
    
    return (
        <section 
            className="mb-6"
            aria-labelledby="insights-heading"
        >
            <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">🧠</span>
                <h2 id="insights-heading" className="font-bold text-white">
                    AI Insights
                </h2>
                <Badge variant="info">Real data</Badge>
            </div>
            
            <div className="space-y-3">
                {insights.map((insight) => (
                    <InsightCard key={insight.id} insight={insight} />
                ))}
            </div>
        </section>
    );
});

/**
 * Stats Overview
 */
export const StatsOverview = memo(() => {
    const { state } = useApp();
    
    const stats = useMemo(() => {
        const activeHabits = state.habitOrder
            .map(id => state.habits[id])
            .filter(h => h && !h.archived);
        
        if (activeHabits.length === 0) {
            return { todayCompleted: 0, todayTotal: 0, weeklyRate: 0, totalStreak: 0, longestStreak: 0 };
        }
        
        const todayKey = DateUtils.toKey();
        const todayCompleted = activeHabits.filter(h => h.data?.[todayKey]).length;
        const todayTotal = activeHabits.length;
        
        // Weekly rate
        let weekTotal = 0;
        let weekCompleted = 0;
        activeHabits.forEach(habit => {
            for (let i = 0; i < 7; i++) {
                const key = DateUtils.toKey(DateUtils.daysAgo(i));
                weekTotal++;
                if (habit.data?.[key]) weekCompleted++;
            }
        });
        const weeklyRate = Math.round((weekCompleted / weekTotal) * 100);
        
        // Best current streak
        let bestStreak = 0;
        let bestLongestStreak = 0;
        activeHabits.forEach(habit => {
            const current = HabitUtils.calculateStreak(habit.data);
            const longest = HabitUtils.calculateLongestStreak(habit.data);
            if (current > bestStreak) bestStreak = current;
            if (longest > bestLongestStreak) bestLongestStreak = longest;
        });
        
        return {
            todayCompleted,
            todayTotal,
            weeklyRate,
            totalStreak: bestStreak,
            longestStreak: bestLongestStreak
        };
    }, [state.habits, state.habitOrder]);
    
    const todayProgress = stats.todayTotal > 0 
        ? Math.round((stats.todayCompleted / stats.todayTotal) * 100) 
        : 0;
    
    return (
        <section 
            className="mb-6"
            aria-labelledby="stats-heading"
        >
            {/* Hero Progress Card */}
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 mb-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12" />
                
                <div className="relative z-10">
                    <h2 id="stats-heading" className="text-indigo-200 text-sm font-medium mb-1">
                        Today's Progress
                    </h2>
                    
                    <div className="flex items-end justify-between">
                        <div>
                            <span className="text-5xl font-bold text-white">{stats.todayCompleted}</span>
                            <span className="text-2xl text-indigo-200">/{stats.todayTotal}</span>
                        </div>
                        
                        <div className="text-right">
                            <div className="text-3xl font-bold text-white">{todayProgress}%</div>
                            <p className="text-xs text-indigo-200">
                                {todayProgress === 100 
                                    ? '🎉 Perfect day!' 
                                    : todayProgress >= 50 
                                        ? 'Keep going!' 
                                        : "Let's start!"}
                            </p>
                        </div>
                    </div>
                    
                    {/* Progress bar */}
                    <div className="mt-4 w-full bg-white/20 h-3 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-white rounded-full transition-all duration-500"
                            style={{ width: `${todayProgress}%` }}
                            role="progressbar"
                            aria-valuenow={todayProgress}
                            aria-valuemin={0}
                            aria-valuemax={100}
                        />
                    </div>
                </div>
            </div>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard 
                    icon="📊" 
                    label="Weekly Rate" 
                    value={`${stats.weeklyRate}%`}
                    subvalue="Last 7 days"
                />
                <StatCard 
                    icon="🔥" 
                    label="Best Streak" 
                    value={stats.totalStreak}
                    subvalue="Current"
                />
                <StatCard 
                    icon="🏆" 
                    label="Record" 
                    value={stats.longestStreak}
                    subvalue="All time"
                />
                <StatCard 
                    icon="❄️" 
                    label="Freezes" 
                    value={state.streakFreezes}
                    subvalue="Available"
                />
            </div>
        </section>
    );
});

/**
 * Habits List
 */
export const HabitsList = memo(({ onEdit, onStartFocus }) => {
    const { state, dispatch } = useApp();
    
    const activeHabits = useMemo(() => 
        state.habitOrder
            .map(id => state.habits[id])
            .filter(h => h && !h.archived),
        [state.habits, state.habitOrder]
    );
    
    const handleToggle = useCallback((id) => {
        dispatch({ type: ActionTypes.TOGGLE_HABIT, payload: { id } });
    }, [dispatch]);
    
    if (activeHabits.length === 0) {
        return (
            <EmptyState
                icon="🎯"
                title="No habits yet"
                description="Create your first habit to start building better routines."
            />
        );
    }
    
    return (
        <section aria-labelledby="habits-heading">
            <h2 id="habits-heading" className="sr-only">Your Habits</h2>
            <div 
                className="space-y-3"
                role="list"
                aria-label="Habits list"
            >
                {activeHabits.map(habit => (
                    <HabitItem
                        key={habit.id}
                        habit={habit}
                        onToggle={handleToggle}
                        onEdit={onEdit}
                        onStartFocus={onStartFocus}
                    />
                ))}
            </div>
        </section>
    );
});

// --- STUDENT OS SPECIFIC COMPONENTS ---

/**
 * Study Timer Component
 */
export const RadarPanel = memo(({ metrics }) => {
    const bgColorMap = {
        indigo: 'bg-indigo-500', emerald: 'bg-emerald-500', amber: 'bg-amber-500',
        rose: 'bg-rose-500', purple: 'bg-purple-500', cyan: 'bg-cyan-500'
    };
    const items = [
        { label: 'CSI', value: metrics.csi?.value || 0, max: 100, color: 'indigo' },
        { label: 'Burnout Risk', value: metrics.burnout?.value || 0, max: 100, color: 'rose', inverted: true },
        { label: 'Research Vel.', value: metrics.researchVelocity?.value || 0, max: 100, color: 'purple' },
        { label: 'Focus', value: metrics.focusStability?.value || 0, max: 100, color: 'cyan' },
        { label: 'Deep Work', value: metrics.deepWork?.value || 0, max: 100, color: 'emerald' },
    ];

    return (
        <div className="bg-slate-900/80 border border-slate-700/60 rounded-lg p-4">
            <div className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-3">Performance Radar</div>
            <div className="space-y-2">
                {items.map(item => {
                    const barColor = item.inverted
                        ? (item.value > 60 ? 'bg-rose-500' : item.value > 30 ? 'bg-amber-500' : 'bg-emerald-500')
                        : (bgColorMap[item.color] || 'bg-indigo-500');
                    return (
                        <div key={item.label} className="flex items-center gap-2">
                            <span className="text-xs font-mono text-slate-400 w-24 truncate">{item.label}</span>
                            <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full ${barColor} rounded-full transition-all duration-500`}
                                    style={{ width: `${Math.min(100, item.value)}%` }}
                                />
                            </div>
                            <span className="text-xs font-mono text-slate-400 w-8 text-right">{item.value}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});

/**
 * Weekly Audit Panel
 */
export const WeeklyAuditPanel = memo(({ dailyMetrics }) => {
    if (dailyMetrics.length < 14) {
        return (
            <div className="bg-slate-900/80 border border-slate-700/60 rounded-lg p-4">
                <div className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-2">Weekly Audit</div>
                <div className="text-sm text-slate-500">Need 14+ days of data</div>
            </div>
        );
    }

    const thisWeek = dailyMetrics.slice(0, 7);
    const lastWeek = dailyMetrics.slice(7, 14);

    const metrics = [
        {
            label: 'Study Hours',
            current: Math.round(thisWeek.reduce((s, m) => s + (m.studyMinutes || 0), 0) / 60 * 10) / 10,
            previous: Math.round(lastWeek.reduce((s, m) => s + (m.studyMinutes || 0), 0) / 60 * 10) / 10,
            unit: 'h'
        },
        {
            label: 'Habit Rate',
            current: Math.round(StatsUtils.mean(thisWeek.map(m => m.habitCompletionRate || 0)) * 100),
            previous: Math.round(StatsUtils.mean(lastWeek.map(m => m.habitCompletionRate || 0)) * 100),
            unit: '%'
        },
        {
            label: 'Avg Sleep',
            current: Math.round(StatsUtils.mean(thisWeek.filter(m => m.sleepHours).map(m => m.sleepHours)) * 10) / 10 || 0,
            previous: Math.round(StatsUtils.mean(lastWeek.filter(m => m.sleepHours).map(m => m.sleepHours)) * 10) / 10 || 0,
            unit: 'h'
        },
        {
            label: 'Exercise Days',
            current: thisWeek.filter(m => m.exerciseMinutes > 0).length,
            previous: lastWeek.filter(m => m.exerciseMinutes > 0).length,
            unit: '/7'
        }
    ];

    return (
        <div className="bg-slate-900/80 border border-slate-700/60 rounded-lg p-4">
            <div className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-3">Weekly Audit — Δ vs Previous</div>
            <div className="space-y-2">
                {metrics.map(m => {
                    const delta = m.current - m.previous;
                    const deltaStr = delta > 0 ? `+${delta}` : `${delta}`;
                    const deltaColor = delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-rose-400' : 'text-slate-500';
                    return (
                        <div key={m.label} className="flex items-center justify-between text-sm">
                            <span className="text-slate-400 font-mono text-xs">{m.label}</span>
                            <div className="flex items-center gap-2">
                                <span className="text-white font-mono">{m.current}{m.unit}</span>
                                <span className={`font-mono text-xs ${deltaColor}`}>{deltaStr}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});

/**
 * Accountability Console — brutal but factual
 */
export const SkillTreePanel = memo(({ skillProgress }) => {
    const bgColorMap = {
        indigo: 'bg-indigo-500', emerald: 'bg-emerald-500', amber: 'bg-amber-500',
        rose: 'bg-rose-500', purple: 'bg-purple-500', cyan: 'bg-cyan-500',
        orange: 'bg-orange-500'
    };
    return (
        <div className="bg-slate-900/80 border border-slate-700/60 rounded-lg p-4">
            <div className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-3">Skill Trees</div>
            <div className="space-y-3">
                {Object.entries(skillProgress).map(([domain, info]) => (
                    <div key={domain}>
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                                <span className="text-base">{info.icon}</span>
                                <span className="text-xs font-mono text-slate-300">{info.name}</span>
                            </div>
                            <div className="text-xs font-mono text-slate-500">
                                {info.level.name} • {info.xp} XP
                            </div>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className={`h-full ${bgColorMap[info.color] || 'bg-indigo-500'} rounded-full transition-all duration-500`}
                                style={{ width: `${info.progress}%` }}
                            />
                        </div>
                        {info.nextLevel && (
                            <div className="text-xs text-slate-600 mt-0.5 font-mono">
                                {info.nextLevel.xpRequired - info.xp} XP to {info.nextLevel.name}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
});

/**
 * Research Log Modal
 */
export const NotificationPanel = memo(({ onClose }) => {
    const { state, dispatch } = useApp();
    const notifications = state.notifications || [];
    const unreadCount = notifications.filter(n => !n.read).length;
    
    const handleMarkRead = (id) => {
        dispatch({ type: ActionTypes.MARK_NOTIFICATION_READ, payload: { id } });
    };
    
    const handleClearAll = () => {
        dispatch({ type: ActionTypes.CLEAR_NOTIFICATIONS });
    };
    
    const handleAction = (notification) => {
        if (notification.actionLink) {
            dispatch({ type: ActionTypes.SET_VIEW, payload: notification.actionLink.tab });
        }
        handleMarkRead(notification.id);
        onClose();
    };
    
    return (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
            <div className="w-full max-w-sm bg-slate-900 border-l border-slate-700 h-full overflow-y-auto shadow-2xl" 
                 onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Notifications">
                <div className="sticky top-0 bg-slate-900 p-4 border-b border-slate-700 flex items-center justify-between">
                    <h3 className="font-bold text-white">🔔 Notifications {unreadCount > 0 && <span className="ml-1 text-xs text-indigo-400">({unreadCount} new)</span>}</h3>
                    <div className="flex gap-2">
                        {notifications.length > 0 && (
                            <button onClick={handleClearAll} className="text-xs text-slate-400 hover:text-white">Clear All</button>
                        )}
                        <button onClick={onClose} className="text-slate-400 hover:text-white text-xl" aria-label="Close">✕</button>
                    </div>
                </div>
                
                {notifications.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                        <div className="text-3xl mb-2">🔔</div>
                        <p className="text-sm">No notifications yet</p>
                    </div>
                ) : (
                    <div className="p-2 space-y-1">
                        {notifications.map(n => (
                            <button key={n.id} onClick={() => handleAction(n)}
                                className={`w-full text-left p-3 rounded-xl transition-colors ${n.read ? 'bg-slate-800/30' : 'bg-indigo-500/10 border border-indigo-500/20'}`}>
                                <div className="flex items-start gap-2">
                                    <span className="text-sm">{!n.read && '🔵'}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-white text-sm">{n.title}</div>
                                        <div className="text-xs text-slate-400 mt-0.5">{n.message}</div>
                                        <div className="text-xs text-slate-500 mt-1">
                                            {new Date(n.createdAt).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
});

// ============================================================================
// SECTION 9: MAIN APP COMPONENT
// ============================================================================

/**
 * Main Application Component
 */
