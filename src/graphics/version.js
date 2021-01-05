class Version {
    constructor() {
        // Set the variables
        this.globalId = 0;
        this.revision = 0;
    }

    equals(other) {
        return this.globalId === other.globalId &&
               this.revision === other.revision;
    }

    copy(other) {
        this.globalId = other.globalId;
        this.revision = other.revision;
    }

    reset() {
        this.globalId = 0;
        this.revision = 0;
    }
}

export { Version };
