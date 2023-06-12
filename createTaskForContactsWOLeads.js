const API = {
    GET_CONTACTS: ['GET', '/api/v4/leads'],
    CREATE_TASK: ['POST', '/api/v4/tasks'],
};

class Response {
    page;
    nextEndpoint;
    embedded;

    constructor(raw) {
        this.page = raw._page;
        this.nextEndpoint = raw?._links.next.href;
        this.embedded = raw._embedded;
    }
}

class Lead {
    closedAt;

    constructor(raw) {
        this.closedAt = raw.closed_at;
    }
}

class Contact {
    id;
    name;
    accountId;
    leads;

    constructor(raw) {
        this.id = raw.id;
        this.name = raw.name;
        this.accountId = raw.account_id;

        this.leads = raw?._embedded.leads.map((leadRaw) => new Lead(leadRaw)) ?? [];
    }

    get hasLeads() {
        return this.leads.filter((lead) => lead.closedAt === undefined).length > 0;
    }
}

const fetchContactsByPage = (limit = 25) => {
    const [method, endpoint] = API.GET_CONTACTS;

    let page = 1;

    return async () => {
        const params = new URLSearchParams({
            with: 'leads',
            limit,
            page,
        });

        let result;

        try {
            const response = await fetch(`${endpoint}?${params}`, {
                method,
            });

            result = new Response(await response.json());
        } catch (e) {
            console.error(e);
        }

        if (result === undefined) {
            return false;
        }

        page++;

        return result;
    };
};

const createTask = async ({message, entityId, entityType, completeTill}, tries = 1) => {
    const [method, endpoint] = API.CREATE_TASK;

    const formData = new FormData();

    formData.append('text', message);
    formData.append('complete_till', completeTill);
    formData.append('entity_id', entityId);
    formData.append('entity_type', entityType);

    try {
        const responseRaw = await fetch(endpoint, {
            method,
            body: formData,
        });

        return await responseRaw.json();
    } catch (e) {
        console.error(e);

        if (tries > 3) {
            return false;
        }

        return await createTask({message, entityId, entityType, completeTill}, tries + 1);
    }
};


(async () => {
    const fetchContacts = fetchContactsByPage();
    const tomorrow = new Date();

    tomorrow.setDate(tomorrow.getDate() + 1);

    let contactsInPage = await fetchContacts();

    while (contactsInPage !== false) {
        const promises = contactsInPage.embedded?.map((contactRaw) => {
            const contact = new Contact(contactRaw);

            if (contact.hasLeads === true) {
                return;
            }

            return createTask({
                message: 'Контакт без сделок',
                entityId: contact.id,
                entityType: 'contacts',
                completeTill: tomorrow.getTime(),
            });
        });

        await Promise.all(promises);

        contactsInPage = await fetchContacts();
    }
})();

