import { Module, VuexModule, Mutation, Action } from "vuex-module-decorators"
import store from "@/store"
import axios from "axios"
import { User } from "./user.module"

export interface Call {
    callId: string
    conferenceId: string
    phone: string
    createdAt: Date
    completedAt: Date
    commonInterests: string[]
}

@Module({ name: "Call", store, dynamic: true })
export default class CallModule extends VuexModule {
    callStatus: "idle" | "calling" | "queue" = "idle"
    loading = false
    calls: Call[] = []
    updateQueueInterval = -1
    refreshQueueCounter = 0

    @Mutation
    setCallStatus(newStatus: "idle" | "calling" | "queue") {
        this.callStatus = newStatus
    }
    @Mutation
    setCalls(newCalls: Call[]) {
        this.calls = newCalls
    }
    @Mutation
    setUpdateQueueInterval(newInterval: number) {
        this.updateQueueInterval = newInterval
    }
    @Mutation
    resetInterval() {
        clearInterval(this.updateQueueInterval)
        this.updateQueueInterval = -1
    }
    @Mutation
    increaseQueueCounter() {
        this.refreshQueueCounter = this.refreshQueueCounter + 1
    }
    @Mutation
    setLoading(newLoading: boolean) {
        this.loading = newLoading
    }

    @Action
    async getCalls(phone: string) {
        try {
            this.setLoading(true)
            const response = await axios.get(`${process.env.VUE_APP_API_URL}/calls/${phone}`)
            this.setLoading(false)
            const { data } = response.data
            this.setCalls(data)
        } catch (error) {
            console.log(error)
            this.setLoading(false)
        }
    }

    @Action
    async findConference(user: User) {
        try {
            this.setLoading(true)
            const response = await axios.post(`${process.env.VUE_APP_API_URL}/conference`, { ...user })
            this.setLoading(false)
            const { data } = response.data
            if (data.queue) {
                // put user in queue
                this.setCallStatus("queue")
                const interval = setInterval(async () => {
                    console.log("checking if still in queue")
                    if (this.refreshQueueCounter === 5) {
                        console.log("Queue timeout, removing user from queue")
                        this.leaveCallQueue(user)
                    } else {
                        this.increaseQueueCounter()
                        const response = await axios.get(
                            `${process.env.VUE_APP_API_URL}/calls/stillInQueue/${user.phone}`,
                        )
                        const { data } = response.data
                        if (data.queue === false) {
                            // not in queue anymore, call started
                            console.log("not in queue anymore, call must have started")
                            this.setCallStatus("calling")
                            this.resetInterval()
                        }
                    }
                }, 5000)
                this.setUpdateQueueInterval(interval)
            } else if (data.queue === false) {
                // call is being initiated
                this.setCallStatus("calling")
            }
        } catch (error) {
            console.log(error)
            this.setCallStatus("idle")
            this.setLoading(false)
        }
    }

    @Action
    async leaveCallQueue(user: User) {
        try {
            this.setLoading(true)
            this.resetInterval()
            this.setCallStatus("idle")
            await axios.post(`${process.env.VUE_APP_API_URL}/conference/leaveQueue`, { ...user })
            this.setLoading(false)
        } catch (error) {
            console.log(error)
            this.setLoading(false)
        }
    }

    @Action
    async completeCall(phone: string) {
        try {
            this.setLoading(true)
            const response = await axios.get(`${process.env.VUE_APP_API_URL}/calls/isCallActive/${phone}`)
            this.setLoading(false)
            const { data } = response.data
            if (data.callActive) {
                // dont allow to complete because call is still active
                console.log("call still active")
            } else {
                // bring user to post call screen
                console.log("call finished, navigate to post call")
            }
        } catch (error) {
            console.log(error)
            this.setLoading(false)
        }
    }
}