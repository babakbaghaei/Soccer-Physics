export class GameState {
    constructor() {
        this.isGameOver = false;
        this.team1Score = 0;
        this.team2Score = 0;
        this.gameTimeRemaining = 120;
        this.roundTimerId = null;
        this.lastGoalScored = null;
        this.currentWeather = 'clear';
        this.fieldType = 'normal';
        this.chipMessageTimer = 0;
        this.isShaking = false;
        this.shakeMagnitude = 0;
        this.shakeDuration = 0;
        this.shakeTimer = 0;
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
        
        // Game stats
        this.gameStats = {
            team1: { shots: 0, jumps: 0, possessions: 0, tackles: 0, mistakes: 0, specialGoals: 0 },
            team2: { shots: 0, jumps: 0, possessions: 0, tackles: 0, mistakes: 0, specialGoals: 0 },
            totalPossessionTime: { team1: 0, team2: 0 },
            lastPossession: null,
            startTime: null,
            endTime: null
        };
    }

    reset() {
        this.isGameOver = false;
        this.team1Score = 0;
        this.team2Score = 0;
        this.gameTimeRemaining = 120;
        this.lastGoalScored = null;
        this.currentWeather = 'clear';
        this.fieldType = 'normal';
        this.chipMessageTimer = 0;
        this.isShaking = false;
        this.shakeMagnitude = 0;
        this.shakeDuration = 0;
        this.shakeTimer = 0;
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
        
        this.gameStats = {
            team1: { shots: 0, jumps: 0, possessions: 0, tackles: 0, mistakes: 0, specialGoals: 0 },
            team2: { shots: 0, jumps: 0, possessions: 0, tackles: 0, mistakes: 0, specialGoals: 0 },
            totalPossessionTime: { team1: 0, team2: 0 },
            lastPossession: null,
            startTime: null,
            endTime: null
        };
    }

    updateShake() {
        if (this.isShaking) {
            this.shakeOffsetX = (Math.random() - 0.5) * this.shakeMagnitude * 2;
            this.shakeOffsetY = (Math.random() - 0.5) * this.shakeMagnitude * 2;
            this.shakeTimer--;
            if (this.shakeTimer <= 0) {
                this.isShaking = false;
                this.shakeOffsetX = 0;
                this.shakeOffsetY = 0;
            }
        } else {
            this.shakeOffsetX = 0;
            this.shakeOffsetY = 0;
        }
    }

    triggerScreenShake(magnitude, duration, pixelationScale) {
        this.isShaking = true;
        this.shakeMagnitude = magnitude * pixelationScale;
        this.shakeDuration = duration;
        this.shakeTimer = duration;
    }

    updatePossession(team) {
        const now = Date.now();
        if (this.gameStats.lastPossession && this.gameStats.lastPossession.team !== team) {
            const duration = now - this.gameStats.lastPossession.time;
            const teamKey = this.gameStats.lastPossession.team === 1 ? 'team1' : 'team2';
            this.gameStats.totalPossessionTime[teamKey] += duration;
        }
        this.gameStats.lastPossession = { team, time: now };
    }

    incrementStat(team, stat) {
        const teamKey = team === 1 ? 'team1' : 'team2';
        if (this.gameStats[teamKey][stat] !== undefined) {
            this.gameStats[teamKey][stat]++;
        }
    }

    getScore() {
        return { team1: this.team1Score, team2: this.team2Score };
    }

    setGoalScored(team) {
        if (team === 1) {
            this.team1Score++;
        } else {
            this.team2Score++;
        }
        this.lastGoalScored = `team${team}`;
        setTimeout(() => { this.lastGoalScored = null; }, 1000);
    }

    isGoalScored() {
        return this.lastGoalScored !== null;
    }
}