import { DEFAULT_PREFS } from "../prefs.js";
import {
	procFieldDataFuncs,
	procHeaderFieldData,
	fieldNameStyleBold,
	fieldNameStyleNone,
	createDateParts,
	getDateFormatString,
	createPrefsObj
} from "../extfuncs.js";


const headerDisplayFieldExamples = {
	author: [ "Isaac Newton", "newton@example.com" ],
	recipients: [ [ "Carl Linnaeus", "linnaeus@example.com" ] ],
	ccList: [
		[ "René Descartes", "descartes@example.com" ],
		[ "Louis Pasteur", "pasteur@example.com" ]
	],
	replyTo: "hungry.for.apples@example.com",
	subject: "Request for feedback on Principia Mathematica"
};


const headerDisplayField = getElById("headerDisplayField");
const headerDisplaySeparatorLine = document.createElement("hr");
headerDisplaySeparatorLine.style.borderStyle = "none";
headerDisplaySeparatorLine.style.borderTopStyle = "inherit";

let prefs = await messenger.storage.local.get()
.catch(_ => DEFAULT_PREFS)
.then(v => createPrefsObj(Object.keys(v).length && v || DEFAULT_PREFS));

headerDisplayFieldExamples.date = new Date(prefs.exampleDateValue);

function populateHeaderDisplayField(updateFieldSet=new Set(),dateOptions=prefs.dateTimeOptions) {
	const fieldDataList = procHeaderFieldData(prefs,headerDisplayFieldExamples,updateFieldSet,dateOptions);
	
	[...headerDisplayField.childNodes].forEach(e => e.remove());
	headerDisplayField.appendChild(headerDisplaySeparatorLine);
	
	fieldDataList.forEach(([name,data],i) => {
		prefs.headerFieldValues[prefs.fieldOrder[i]] = data;
		const fieldNodes = prefs.boldFieldNames ? fieldNameStyleBold(name,data) : fieldNameStyleNone(name,data);
		fieldNodes.forEach(v => headerDisplayField.appendChild(v));
		headerDisplayField.appendChild(document.createElement("br"));
	});
}


// UTILITY FUNCTIONS
function getElById(id) { return document.getElementById(id); }
function addListenerById(id,action,fn) { getElById(id).addEventListener(action,fn,false); }


// FROM and TO & CC //

Array.from(document.getElementsByName("headerFrom"))
.forEach(el => el.addEventListener("click",e => {
	prefs.fieldFrom = +e.target.value;
	prefs.headerFieldValues.from = getElById("displayFrom").firstElementChild.innerText = procFieldDataFuncs.from(headerDisplayFieldExamples.author,prefs.fieldFrom);
	populateHeaderDisplayField();
},false));

Array.from(document.getElementsByName("headerToCc"))
.forEach(el => el.addEventListener("click",e => {
	prefs.fieldToCc = +e.target.value;
	getElById("displayToCc").firstElementChild.innerText = procFieldDataFuncs.to(headerDisplayFieldExamples.recipients,prefs.fieldToCc);
	populateHeaderDisplayField(new Set([ "to","cc" ]));
},false));

getElById(`fromOption${prefs.fieldFrom}`).click();
getElById(`toCcOption${prefs.fieldToCc}`).click();


// DATE & TIME //

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/formatToParts
// https://tc39.es/ecma402/#sec-Intl.DateTimeFormat.prototype.formatToParts
(function loadDateTime() {
	const [
		customDateInput,
		customDateBtn,
		dateSelect,
		hour24,
		displayDateP,
		inputDate,
		shortWeekday,
		shortMonth,
		timezoneInput
	] = [
		"customDateInput",
		"customDateBtn",
		"dateSelect",
		"hour24",
		"displayDateP",
		"inputDate",
		"shortWeekday",
		"shortMonth",
		"timezoneInput"
	].map(e => getElById(e));
	
	const tzList = Intl.supportedValuesOf("timeZone")
	.concat([ "US/Alaska","US/Pacific","US/East-Indiana","US/Central","US/Mountain" ]);
	const tzSet = tzList.reduce((a,tz) => a.add(tz),new Set());
	const tzDataList = document.createElement("datalist");
	
	tzDataList.id = "timezoneList";
	tzList.forEach(tz => {
		const option = document.createElement("option");
		option.value = tz;
		tzDataList.appendChild(option);
	});
	
	function updateDateFormat(format=prefs.fieldDateCustom) {
		const n = prefs.fieldDate;
		const timeZone = prefs.fieldTimeZone ? "UTC" : prefs.dateTimeOptions.timeZone;
		if (n !== 2) { Object.assign(prefs.dateTimeOptions,dateOptionsList(n)); }
		const options = n !== 2 ? Object.assign({},prefs.dateTimeOptions,{ timeZone }) : Object.assign({},prefs.dateTimeOptions,dateOptionsList(n),{ timeZone });
		dateSelect.value = n.toString();
		prefs.fieldDateCustom = format;
		customDateInput.disabled = n < 3;
		customDateBtn.disabled = n < 3;
		hour24.checked = n === 2 ? true : prefs.fieldDate24Hour;
		hour24.disabled = n === 2;
		displayDateP.innerText = prefs.headerFieldValues.date = getDateFormatString(n,headerDisplayFieldExamples.date,prefs,options,format);
		populateHeaderDisplayField();
	}
	
	const dateOptionsList = n => [
		{ hour: "2-digit", day: "numeric" },// ERH
		{ hour: "numeric", day: "numeric" },// GMail
		{
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour12: false,
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit"
		},// ISO 8601
		prefs.dateTimeOptions// user-defined
	][n];
	
	dateSelect.addEventListener("input",e => {
		prefs.fieldDate = +e.target.value;
		updateDateFormat();
	},false);
	
	customDateInput.addEventListener("keydown",e => {
		if (e.key === "Escape") {
			customDateInput.value = prefs.fieldDateCustom;
			customDateInput.blur();
		}
	},false);
	
	customDateBtn.addEventListener("click",_ => {
		prefs.fieldDate = 3;
		updateDateFormat(customDateInput.value);
	},false);
	
	hour24.addEventListener("click",e => {
		const h24 = prefs.fieldDate24Hour = e.target.checked;
		prefs.dateTimeOptions.hour12 = !h24;
		updateDateFormat();
	},false);
	
	Array.from(document.getElementsByName("timezoneSelect"))
	.forEach(el => el.addEventListener("click",v => {
		const i = +v.target.value;
		timezoneInput.disabled = Boolean(i);
		prefs.fieldTimeZone = i;
		updateDateFormat();
	},false));
	
	timezoneInput.addEventListener("change",e => {
		const tz = tzSet.has(e.target.value) ? e.target.value : prefs.dateTimeOptions.timeZone;
		timezoneInput.value = prefs.dateTimeOptions.timeZone = tz;
		updateDateFormat();
	},false);
	
	shortWeekday.addEventListener("click",el => {
		const isShort = el.target.checked;
		const len = isShort ? "short" : "long";
		prefs.fieldDateShortDay = isShort;
		prefs.dateTimeOptions.weekday = len;
		updateDateFormat();
	},false);
	
	shortMonth.addEventListener("click",el => {
		const isShort = el.target.checked;
		const len = isShort ? "short" : "long";
		prefs.fieldDateShortMonth = isShort;
		prefs.dateTimeOptions.month = len;
		updateDateFormat();
	},false);
	
	inputDate.addEventListener("input",el => {
		headerDisplayFieldExamples.date = el.target.valueAsDate;
		prefs.exampleDateValue = headerDisplayFieldExamples.date.valueOf();
		updateDateFormat();
	},false);
	
	// display current date in date input
	inputDate.value = (options => {
		const { year,month,day,hour,minute,second } = createDateParts(headerDisplayFieldExamples.date,prefs.locale,options);
		return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
	})(Object.assign({},prefs.dateTimeOptions,{ year: "numeric", month: "2-digit", day: "2-digit", hour12: false, timeZone: "UTC" }));
	
	getElById("headerStyleDate").appendChild(tzDataList);
	customDateInput.value = prefs.fieldDateCustom;
	shortWeekday.checked = prefs.fieldDateShortDay;;
	shortMonth.checked = prefs.fieldDateShortMonth;
	timezoneInput.value = prefs.dateTimeOptions.timeZone;
	getElById(`tz${prefs.fieldTimeZone}`).click();
	updateDateFormat();
})();


// HEADER FIELDS ORDERING //

(function loadHeaderFieldsOrdering() {
	const fieldListWrapper = getElById("headersFieldOrdering");
	
	function renameHeaderField(el) {
		if (el.type === "button") { return false; }
		if (el.localName === "p") { el = el.parentElement; }
		const p = el.firstElementChild;
		const oldName = p.textContent;
		const v = document.createElement("textarea");
		[
			["maxlength",30],
			["minlength",1],
			["rows",1]
		].forEach(([attr,val]) => v.setAttribute(attr,val));
		v.textContent = oldName;
		p.remove();
		el.insertBefore(v,el.firstElementChild);
		v.focus();
		v.select();
		v.addEventListener("focusout",e => {
			el.insertBefore(p,v);
			v.remove();
		},false);
		v.addEventListener("keydown",e => {
			if (["Enter","Escape"].includes(e.key)) {
				v.value = v.value.trim();
				if (e.key === "Enter" && v.value) {
					const field = el.id.slice(2).toLowerCase();
					p.textContent = v.value;
					prefs.fieldHeaderFieldNames[field] = v.value;
					populateHeaderDisplayField();
				}
				el.insertBefore(p,v);
				v.remove();
			}
		},false);
	}
	
	// create "add/remove" button
	function createFieldCheckButton() {
		const btn = document.createElement("button");
		btn.setAttribute("type","button");
		btn.appendChild(document.createTextNode("REMOVE"));
		btn.addEventListener("click",e => {
			const li = e.target.parentNode,
				ul = li.parentNode;
			li.classList.toggle("removedli");
			if (e.target.textContent === "REMOVE") {
				e.target.textContent = "ADD";
				li.setAttribute("draggable",false);
				li.classList.remove("droppable");
				ul.appendChild(li);
			} else {
				e.target.textContent = "REMOVE";
				li.setAttribute("draggable",true);
				li.classList.add("droppable");
				for (let v of ul.children) {
					if (v.classList.contains("removedli")) {
						ul.insertBefore(li,v);
						break;
					}
				}
			}
			updateHeaderFieldsOrdering();
			populateHeaderDisplayField();
		},false);
		return btn;
	}
	
	function updateHeaderFieldsOrdering() {
		let i = 0;
		prefs.fieldOrder = [...fieldListWrapper.children].map(item => {
			if (item.children[1].textContent === "REMOVE") { i++; }
			return item.id.slice(2).toLowerCase();
		});
		prefs.activeHeaderFieldCount = i;
	}
	
	// populate list items
	prefs.fieldOrder.forEach((field,i) => {
		const li = document.createElement("li"),
			label = document.createElement("p");
		li.id = `li${field.capitalize()}`;
		li.classList.add("dragli");
		if (i < prefs.activeHeaderFieldCount) {
			li.classList.add("droppable");
			li.setAttribute("draggable",true);
		} else {
			li.classList.add("removedli");
		}
		label.textContent = prefs.fieldHeaderFieldNames[field];
		li.appendChild(label);
		li.appendChild(createFieldCheckButton());
		fieldListWrapper.appendChild(li);
	});
	
	// make list elements draggable
	Array.from(document.getElementsByClassName("dragli")).forEach(el => {
		el.addEventListener("dragstart",e => {
			e.dataTransfer.setData("text/plain",e.target.id);
			e.dataTransfer.effectAllowed = "move";
		});
		
		el.addEventListener("dragenter",e => { e.preventDefault(); });
		el.addEventListener("dragover",e => { e.preventDefault(); });
		
		el.addEventListener("drop",e => {
			e.preventDefault();
			const data = e.dataTransfer.getData("text/plain");
			const movedLi = getElById(data);
			const target = e.target.localName === "p" ? e.target.parentNode : e.target;
			let siblingLi;
			if (target.classList.contains("removedli")) {
				for (let li of target.parentNode.children) {
					if (li.classList.contains("removedli")) {
						siblingLi = li;
						break;
					}
				}
			} else {
				siblingLi = movedLi.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING ? target.nextSibling : target;
			}
			fieldListWrapper.insertBefore(movedLi,siblingLi);
			updateHeaderFieldsOrdering();
			populateHeaderDisplayField();
		});
		
		el.addEventListener("dblclick", e => renameHeaderField(e.target),false);
	});
})();


// COSMETIC STYLING //

(function loadCosmetics() {
	const [
		customFontInput,
		customFontTextInput,
		fontSelector,
		fontSizeSelect,
		fontColorSelect,
		boldFieldNames,
		lineSeparatorWidth,
		noLine,
		lineColorSelect,
		lineStyleSelect,
		rangeVal
	] = [
		"customFont",
		"customFontTextInput",
		"fontSelector",
		"fontSizeSelect",
		"fontColorSelect",
		"boldFieldNames",
		"lineSeparatorWidth",
		"noLine",
		"lineColorSelect",
		"lineStyleSelect",
		"rangeVal"
	].map(el => getElById(el));
	
	const defaultFontList = ["monospace","serif","sans-serif","cursive","system-ui"];
	
	function updateFontFace(idx,typeface=prefs.fontFaceCustom) {
		fontSelector.value = prefs.fontFace = idx;
		if (idx < 5) {
			customFontInput.style.visibility = "hidden";
			headerDisplayField.style.fontFamily = defaultFontList[idx];
		} else {
			customFontInput.style.visibility = "visible";
			headerDisplayField.style.fontFamily = prefs.fontFaceCustom = typeface;
		}
	}
	
	updateFontFace(prefs.fontFace);
	fontSizeSelect.value = prefs.fontSize;
	rangeVal.value = prefs.fontSize;
	fontColorSelect.value = prefs.fontColor;
	boldFieldNames.checked = prefs.boldFieldNames;
	customFontTextInput.value = prefs.fontFaceCustom;
	lineSeparatorWidth.value = prefs.lineSeparatorWidth;
	lineColorSelect.value = prefs.lineSeparatorColor;
	lineStyleSelect.value = prefs.lineSeparatorStyle;
	noLine.checked = prefs.removeSeparatorLine;
	
	headerDisplayField.style.fontSize = `${prefs.fontSize}px`;
	headerDisplaySeparatorLine.style.borderTopWidth = `${lineSeparatorWidth.value}px`;
	headerDisplaySeparatorLine.style.borderTopColor = lineColorSelect.value;
	headerDisplaySeparatorLine.style.borderTopStyle = lineStyleSelect.value;
	headerDisplaySeparatorLine.style.display = noLine.checked ? "none" : "inherit";
	
	fontSelector.addEventListener("input",e => updateFontFace(+e.target.value),false);
	
	customFontTextInput.addEventListener("keydown",e => {
		if (["Enter","Escape"].includes(e.key)) {
			if (e.key === "Enter") {
				updateFontFace(5,customFontTextInput.value);
			} else {
				customFontTextInput.value = prefs.fontFaceCustom;
			}
			customFontTextInput.blur();
		}
	},false);
	
	addListenerById("customFontBtn","click",_ => updateFontFace(5,customFontTextInput.value));
	
	fontSizeSelect.addEventListener("input",e => {
		const v = +e.target.value;
		rangeVal.value = prefs.fontSize = v;
		headerDisplayField.style.fontSize = `${v}px`;
	},false);
	
	fontColorSelect.addEventListener("change",e => headerDisplayField.style.color = prefs.fontColor = e.target.value,false);
	
	boldFieldNames.addEventListener("click",e => {
		prefs.boldFieldNames = e.target.checked;
		populateHeaderDisplayField();
	},false);
	
	lineSeparatorWidth.addEventListener("input",e => headerDisplaySeparatorLine.style.borderTopWidth = `${prefs.lineSeparatorWidth = +e.target.value}px`,false);
	
	noLine.addEventListener("click",_ => {
		headerDisplaySeparatorLine.style.display = noLine.checked ? "none" : "inherit";
		prefs.removeSeparatorLine = noLine.checked;
	},false);
	
	lineColorSelect.addEventListener("change",e => headerDisplaySeparatorLine.style.borderTopColor = prefs.lineSeparatorColor = e.target.value,false);
	
	lineStyleSelect.addEventListener("change",e => headerDisplaySeparatorLine.style.borderTopStyle = prefs.lineSeparatorStyle = e.target.value,false);
})();


addListenerById("saveBtn","click",async _ => {
	await messenger.runtime.sendMessage(prefs)
	.catch(e => console.error(`Failed to execute runtime.sendMessage: ${e}`))
	.finally(window.close);
});

addListenerById("cancelBtn","click",_ => window.close());


// CREDITS & HELP TAB
addListenerById("reportIssue","click",_ => window.open("https://github.com/docgunthrop/Enhanced-Reply-Headers/issues"));
addListenerById("gotoExtPage","click",_ => window.open("https://addons.thunderbird.net/En-US/thunderbird/extensions/"));
addListenerById("resetSettings","click", async _ => {
	if (window.confirm("Are you sure you want to reset the settings back to defaults?")) {
		await messenger.runtime.sendMessage(DEFAULT_PREFS)
		.catch(e => console.error(`Failed to execute runtime.sendMessage: ${e}`))
		.finally(window.close);
	}
} );


document.addEventListener("DOMContentLoaded",_ => populateHeaderDisplayField(),{ once: true });