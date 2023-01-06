import { DEFAULT_PREFS } from "./prefs.js";
import {
	// procFieldDataFuncs,
	procHeaderFieldData,
	fieldNameStyleBold,
	fieldNameStyleNone,
	createDateParts,
	getDateFormatString,
	createPrefsObj,
	isEmptyObj
} from "./extfuncs.js";

let prefs = {};

async function setPrefs() {
	prefs = await messenger.storage.local.get()
	.catch(_ => DEFAULT_PREFS)
	.then(v => createPrefsObj(Object.keys(v).length && v || DEFAULT_PREFS));
}

// Load preferences on app startup
messenger.runtime.onStartup.addListener(setPrefs);

(async () => {
	const parseTextToHtml = text => new DOMParser().parseFromString(text,"text/html");
	const htmlToText = node => new XMLSerializer().serializeToString(node);
	
	function transformHTMLBody(body,type,newHeader) {
		const html = parseTextToHtml(body);
		const headerNode = type === "reply" ? "moz-cite-prefix" : "moz-email-headers-table";
		const oldHeader = html.getElementsByClassName(headerNode)[0];
		const wrapper = oldHeader.parentNode;
		wrapper.insertBefore(newHeader,oldHeader);
		oldHeader.remove();
		
		if (type !== "reply") { newHeader.previousSibling.remove(); }
		if (!prefs.removeSeparatorLine) { wrapper.insertBefore(createSeparatorLine(prefs),newHeader); }
		
		return htmlToText(html);
	}
	
	function transformPlaintextBody(body,type,newHeader) {
		if (type === "reply") {
			let endIdx = body.indexOf("wrote:\n>");
			return `\n\n-------- Original Message --------\n${newHeader}\n\n${body.slice(endIdx+6)}`;
		} else {
			const fwdHeaderMatch = body.match(/\nTo:\s+[^\n]+\n/);
			if (!fwdHeaderMatch) { console.error("transformPlaintextBody: error with regex match"); }
			let startBodyIndex = fwdHeaderMatch.index + fwdHeaderMatch[0].length;
			let contentBody = body.slice(startBodyIndex);
			contentBody = contentBody.slice(contentBody.indexOf("\n\n"));
			return `\n\n-------- Forwarded Message --------\n${newHeader}\n${contentBody}`;
		}
	}
	
	function createSeparatorLine(prefObj) {
		const {
			lineSeparatorStyle,
			lineSeparatorWidth,
			lineSeparatorColor
		} = prefObj;
		const hr = document.createElement("hr");
		hr.style.borderStyle = "none";
		hr.style.borderTopStyle = lineSeparatorStyle;
		hr.style.borderTopWidth = `${lineSeparatorWidth}px`;
		hr.style.borderTopColor = lineSeparatorColor;
		hr.style.paddingLeft = "1.5em";
		hr.style.paddingRight = "1.5em";
		return hr;
	}
	
	function parseEmailAddressString(str) {
		const regx = /\s<[^>]+@.+\.\w+>$/;
		if (!regx.test(str)) { return ["",str]; }
		const match = str.match(regx);
		const address = match[0].slice(2,-1);
		const name = str.slice(0,match.index);
		return [ name,address ];
	}
	
	function refineFields(fields) {
		const refFields = Object.assign({},fields);
		refFields.author = parseEmailAddressString(refFields.author);
		refFields.recipients = refFields.recipients.map(parseEmailAddressString);
		refFields.ccList = refFields.ccList.map(parseEmailAddressString);
		return refFields;
	}
	
	function fontStyling() {
		const fontFamily = ["monospace","serif","sans-serif","cursive","system-ui",prefs.fontFaceCustom][prefs.fontFace];
		const colorStr = /^#0+$/.test(prefs.fontColor) ? "" : `color: ${prefs.fontColor}; `;// allows visibility of text in TB dark theme
		return `font-family: ${fontFamily}; ${colorStr}font-size: ${prefs.fontSize}px;`;
	}
	
	async function makeEnhancedHeaderTable(fields) {
		const headerFieldData = refineFields(fields);
		const table = document.createElement("table"),
			  tbody = table.appendChild(document.createElement("tbody")),
			  fieldDataList = procHeaderFieldData(prefs,headerFieldData,new Set(prefs.fieldOrder),prefs.dateTimeOptions),
			  fontStyle = fontStyling();
		const padpix = 5;/// tentative default
		["border-spacing","cellpadding","border"].forEach(prop => table.setAttribute(prop,0));
		table.setAttribute("class","ehr-email-headers-table");
		
		fieldDataList.forEach(([name,data]) => {
			if (!data.length) { return; }
			const tr = tbody.appendChild(document.createElement("tr")),
				  th = tr.appendChild(document.createElement("th")),
				  td = tr.appendChild(document.createElement("td")),
				  fn = prefs.boldFieldNames ? fieldNameStyleBold : fieldNameStyleNone,
				  [ prop,val ] = fn(name,data);
			
			[
				["vertical-align","baseline"],
				["nowrap","nowrap"],
				["style",`text-align:left; padding-right:${padpix}px; ${fontStyle}`]
			].forEach(([k,v]) => th.setAttribute(k,v));
			td.setAttribute("style",fontStyle);
			th.appendChild(prop);
			td.appendChild(val);
		});
		
		return table;
	}
	
	async function composeTransform(details) {
		let {
			body,
			isPlainText,
			plainTextBody,
			relatedMessageId,
			type
		} = details;
		
		const {
			author,
			ccList,// array
			date,
			recipients,// array
			subject
		} = await messenger.messages.get(relatedMessageId);
		
		const { headers } = await messenger.messages.getFull(relatedMessageId);
		const replyTo = headers["reply-to"] || [];
		
		const enhancedHeader = await makeEnhancedHeaderTable({
			author,
			ccList,
			date,
			recipients,
			subject,
			replyTo
		});
		
		if (!isPlainText) { body = await transformHTMLBody(body,type,enhancedHeader); }
		// always modify plaintext header
		plainTextBody = transformPlaintextBody(plainTextBody,type,nodeHeaderToText(enhancedHeader));
		
		return { plainTextBody, body };
	}
	
	function nodeHeaderToText(node) {
		const fields = Array.from(node.querySelector("tbody").children);
		return fields.map(child => Array.from(child.children).map(el => el.textContent).join("")).join("\n");
	}
	
	// Receive update from options page
	await messenger.runtime.onMessage.addListener(async obj => {
		prefs = createPrefsObj(obj);
		await messenger.storage.local.set(createPrefsObj(prefs));
	});
	
	// Mutate reply/forward messages with updated header details
	await messenger.tabs.onCreated.addListener(async tab => {
		// console.debug(`windowId: ${tab.windowId}\ntabId: ${tab.id}`);
		if (isEmptyObj(prefs)) { setPrefs(); }
		if (tab.type === "messageCompose") {
			const composeDetails = await messenger.compose.getComposeDetails(tab.id);
			if (["reply","forward"].includes(composeDetails.type)) {
				// console.log(composeDetails);
				await messenger.compose.setComposeDetails(tab.id,await composeTransform(composeDetails));
			}
		}
	});
})();