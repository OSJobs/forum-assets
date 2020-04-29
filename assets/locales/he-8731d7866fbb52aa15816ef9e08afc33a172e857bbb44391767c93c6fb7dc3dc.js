/*global I18n:true */

// Instantiate the object
var I18n = I18n || {};

// Set default locale to english
I18n.defaultLocale = "en";

// Set default pluralization rule
I18n.pluralizationRules = {
  en: function(n) {
    return n === 0 ? ["zero", "none", "other"] : n === 1 ? "one" : "other";
  }
};

// Set current locale to null
I18n.locale = null;
I18n.fallbackLocale = null;

// Set the placeholder format. Accepts `{{placeholder}}` and `%{placeholder}`.
I18n.PLACEHOLDER = /(?:\{\{|%\{)(.*?)(?:\}\}?)/gm;

I18n.SEPARATOR = ".";

I18n.noFallbacks = false;

I18n.isValidNode = function(obj, node, undefined) {
  return obj[node] !== null && obj[node] !== undefined;
};

I18n.lookup = function(scope, options) {
  options = options || {};

  var translations = this.prepareOptions(I18n.translations),
    locale = options.locale || I18n.currentLocale(),
    messages = translations[locale] || {},
    currentScope;

  options = this.prepareOptions(options);

  if (typeof scope === "object") {
    scope = scope.join(this.SEPARATOR);
  }

  if (options.scope) {
    scope = options.scope.toString() + this.SEPARATOR + scope;
  }

  var originalScope = scope;
  scope = scope.split(this.SEPARATOR);

  if (scope.length > 0 && scope[0] !== "js") {
    scope.unshift("js");
  }

  while (messages && scope.length > 0) {
    currentScope = scope.shift();
    messages = messages[currentScope];
  }

  if (messages === undefined && this.extras && this.extras[locale]) {
    messages = this.extras[locale];
    scope = originalScope.split(this.SEPARATOR);

    while (messages && scope.length > 0) {
      currentScope = scope.shift();
      messages = messages[currentScope];
    }
  }

  if (messages === undefined) {
    messages = options.defaultValue;
  }

  return messages;
};

// Merge serveral hash options, checking if value is set before
// overwriting any value. The precedence is from left to right.
//
//   I18n.prepareOptions({name: "John Doe"}, {name: "Mary Doe", role: "user"});
//   #=> {name: "John Doe", role: "user"}
//
I18n.prepareOptions = function() {
  var options = {},
    opts,
    count = arguments.length;

  for (var i = 0; i < count; i++) {
    opts = arguments[i];

    if (!opts) {
      continue;
    }

    for (var key in opts) {
      if (!this.isValidNode(options, key)) {
        options[key] = opts[key];
      }
    }
  }

  return options;
};

I18n.interpolate = function(message, options) {
  options = this.prepareOptions(options);

  var matches = message.match(this.PLACEHOLDER),
    placeholder,
    value,
    name;

  if (!matches) {
    return message;
  }

  for (var i = 0; (placeholder = matches[i]); i++) {
    name = placeholder.replace(this.PLACEHOLDER, "$1");

    if (typeof options[name] === "string") {
      // The dollar sign (`$`) is a special replace pattern, and `$&` inserts
      // the matched string. Thus dollars signs need to be escaped with the
      // special pattern `$$`, which inserts a single `$`.
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace#Specifying_a_string_as_a_parameter
      value = options[name].replace(/\$/g, "$$$$");
    } else {
      value = options[name];
    }

    if (!this.isValidNode(options, name)) {
      value = "[missing " + placeholder + " value]";
    }

    var regex = new RegExp(
      placeholder.replace(/\{/gm, "\\{").replace(/\}/gm, "\\}")
    );
    message = message.replace(regex, value);
  }

  return message;
};

I18n.translate = function(scope, options) {
  options = this.prepareOptions(options);
  options.needsPluralization = typeof options.count === "number";
  options.ignoreMissing = !this.noFallbacks;

  var translation = this.findTranslation(scope, options);

  if (!this.noFallbacks) {
    if (!translation && this.fallbackLocale) {
      options.locale = this.fallbackLocale;
      translation = this.findTranslation(scope, options);
    }

    options.ignoreMissing = false;

    if (!translation && this.currentLocale() !== this.defaultLocale) {
      options.locale = this.defaultLocale;
      translation = this.findTranslation(scope, options);
    }

    if (!translation && this.currentLocale() !== "en") {
      options.locale = "en";
      translation = this.findTranslation(scope, options);
    }
  }

  try {
    return this.interpolate(translation, options);
  } catch (error) {
    return this.missingTranslation(scope);
  }
};

I18n.findTranslation = function(scope, options) {
  var translation = this.lookup(scope, options);

  if (translation && options.needsPluralization) {
    translation = this.pluralize(translation, scope, options);
  }

  return translation;
};

I18n.toNumber = function(number, options) {
  options = this.prepareOptions(options, this.lookup("number.format"), {
    precision: 3,
    separator: this.SEPARATOR,
    delimiter: ",",
    strip_insignificant_zeros: false
  });

  var negative = number < 0,
    string = Math.abs(number)
      .toFixed(options.precision)
      .toString(),
    parts = string.split(this.SEPARATOR),
    precision,
    buffer = [],
    formattedNumber;

  number = parts[0];
  precision = parts[1];

  while (number.length > 0) {
    buffer.unshift(number.substr(Math.max(0, number.length - 3), 3));
    number = number.substr(0, number.length - 3);
  }

  formattedNumber = buffer.join(options.delimiter);

  if (options.precision > 0) {
    formattedNumber += options.separator + parts[1];
  }

  if (negative) {
    formattedNumber = "-" + formattedNumber;
  }

  if (options.strip_insignificant_zeros) {
    var regex = {
      separator: new RegExp(options.separator.replace(/\./, "\\.") + "$"),
      zeros: /0+$/
    };

    formattedNumber = formattedNumber
      .replace(regex.zeros, "")
      .replace(regex.separator, "");
  }

  return formattedNumber;
};

I18n.toHumanSize = function(number, options) {
  var kb = 1024,
    size = number,
    iterations = 0,
    unit,
    precision;

  while (size >= kb && iterations < 4) {
    size = size / kb;
    iterations += 1;
  }

  if (iterations === 0) {
    unit = this.t("number.human.storage_units.units.byte", { count: size });
    precision = 0;
  } else {
    unit = this.t(
      "number.human.storage_units.units." +
        [null, "kb", "mb", "gb", "tb"][iterations]
    );
    precision = size - Math.floor(size) === 0 ? 0 : 1;
  }

  options = this.prepareOptions(options, {
    precision: precision,
    format: "%n%u",
    delimiter: ""
  });

  number = this.toNumber(size, options);
  number = options.format.replace("%u", unit).replace("%n", number);

  return number;
};

I18n.pluralizer = function(locale) {
  var pluralizer = this.pluralizationRules[locale];
  if (pluralizer !== undefined) return pluralizer;
  return this.pluralizationRules["en"];
};

I18n.findAndTranslateValidNode = function(keys, translation) {
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (this.isValidNode(translation, key)) return translation[key];
  }
  return null;
};

I18n.pluralize = function(translation, scope, options) {
  if (typeof translation !== "object") return translation;

  options = this.prepareOptions(options);
  var count = options.count.toString();

  var pluralizer = this.pluralizer(options.locale || this.currentLocale());
  var key = pluralizer(Math.abs(count));
  var keys = typeof key === "object" && key instanceof Array ? key : [key];

  var message = this.findAndTranslateValidNode(keys, translation);

  if (message !== null || options.ignoreMissing) {
    return message;
  }

  return this.missingTranslation(scope, keys[0]);
};

I18n.missingTranslation = function(scope, key) {
  var message = "[" + this.currentLocale() + this.SEPARATOR + scope;
  if (key) {
    message += this.SEPARATOR + key;
  }
  return message + "]";
};

I18n.currentLocale = function() {
  return I18n.locale || I18n.defaultLocale;
};

I18n.enableVerboseLocalization = function() {
  var counter = 0;
  var keys = {};
  var t = I18n.t;

  I18n.noFallbacks = true;

  I18n.t = I18n.translate = function(scope, value) {
    var current = keys[scope];
    if (!current) {
      current = keys[scope] = ++counter;
      var message = "Translation #" + current + ": " + scope;
      if (!_.isEmpty(value)) {
        message += ", parameters: " + JSON.stringify(value);
      }
      // eslint-disable-next-line no-console
      console.info(message);
    }
    return t.apply(I18n, [scope, value]) + " (#" + current + ")";
  };
};

I18n.enableVerboseLocalizationSession = function() {
  sessionStorage.setItem("verbose_localization", "true");
  I18n.enableVerboseLocalization();

  return "Verbose localization is enabled. Close the browser tab to turn it off. Reload the page to see the translation keys.";
};

// shortcuts
I18n.t = I18n.translate;


MessageFormat = {locale: {}};
I18n._compiledMFs = {"too_few_topics_and_posts_notice_MF" : function(d){
var r = "";
r += "הבה <a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">נתחיל להתדיין!</a> כרגע יש ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "נושא <strong>אחד</strong>";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> נושאים";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["he"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ו";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "פוסט <strong>אחד</strong>";
return r;
},
"other" : function(d){
var r = "";
r += "־<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> פוסטים";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["he"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ". המבקרים זקוקים ליותר מכך כדי לקרוא ולהיות מעורבים – אנו ממליצים על ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "נושא<strong>אחד</strong>";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> נושאים";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["he"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ו";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "פוסט <strong>אחד</strong>";
return r;
},
"other" : function(d){
var r = "";
r += "־<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> פוסטים";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["he"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " לפחות. רק חברי הסגל יכולים לראות את ההודעה הזאת.";
return r;
}, "too_few_topics_notice_MF" : function(d){
var r = "";
r += "הבה <a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">נתחיל להתדיין!</a> כרגע יש ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "נושא <strong>אחד</strong>";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> נושאים";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["he"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ". המבקרים זקוקים ליותר מכך כדי לקרוא ולהיות מעורבים – אנו ממליצים על ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "נושא<strong>אחד</strong>";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> נושאים";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["he"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " לפחות. רק חברי הסגל יכולים לראות את ההודעה הזאת.";
return r;
}, "too_few_posts_notice_MF" : function(d){
var r = "";
r += "הבה <a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">נתחיל להתדיין!</a> כרגע יש ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "פוסט <strong>אחד</strong>";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> פוסטים";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["he"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ". המבקרים זקוקים ליותר מכך כדי לקרוא ולהיות מעורבים – אנו ממליצים על ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "פוסט <strong>אחד</strong>";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong> פוסטים";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["he"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " לפחות. רק חברי הסגל יכולים לראות את ההודעה הזאת.";
return r;
}, "logs_error_rate_notice.reached_hour_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b> – <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["url"];
r += "' target='_blank'>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "rate";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "שגיאה אחת בשעה הגיעה";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " שגיאות בשעה הגיעו";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["he"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a> למגבלת האתר שהיא ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "שגיאה אחת בשעה";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " שגיאות בשעה";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["he"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ".";
return r;
}, "logs_error_rate_notice.reached_minute_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b> – <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["url"];
r += "' target='_blank'>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "rate";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "שגיאה אחת בדקה הגיעה";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " שגיאות בדקה הגיעו";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["he"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a> למגבלת האתר שהיא ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "שגיאה אחת בדקה";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " שגיאות בדקה";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["he"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ".";
return r;
}, "logs_error_rate_notice.exceeded_hour_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b> – <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["url"];
r += "' target='_blank'>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "rate";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "שגיאה אחת בשעה חרגה";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " שגיאות בשעה חרגו";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["he"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a> ממגבלת האתר שהיא ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "שגיאה אחת בשעה";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " שגיאות בשעה";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["he"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ".";
return r;
}, "logs_error_rate_notice.exceeded_minute_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b> – <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["url"];
r += "' target='_blank'>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "rate";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "שגיאה אחת בדקה חרגה";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " שגיאות בדקה חרגו";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["he"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a> ממגבלת האתר שהיא ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "שגיאה אחת בדקה";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " שגיאות בדקה";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["he"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ".";
return r;
}, "topic.read_more_MF" : function(d){
var r = "";
r += "יש ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "UNREAD";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"0" : function(d){
var r = "";
return r;
},
"one" : function(d){
var r = "";
r += "<a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>1 שלא נקרא</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "<a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " שלא נקראו</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["he"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "NEW";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"0" : function(d){
var r = "";
return r;
},
"one" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "BOTH";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"true" : function(d){
var r = "";
r += "ו";
return r;
},
"false" : function(d){
var r = "";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " נושא חדש <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/new'>אחד</a>";
return r;
},
"other" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "BOTH";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"true" : function(d){
var r = "";
r += "ו";
return r;
},
"false" : function(d){
var r = "";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/new'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</a> נושאים חדשים";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["he"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " נותרים, או ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "עיין בנושאים אחרים ב־";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["catLink"];
return r;
},
"false" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["latestLink"];
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_0[ k_1 ] || pf_0[ "other" ])( d );
return r;
}, "topic.bumped_at_title_MF" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["FIRST_POST"];
r += ": ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["CREATED_AT"];
r += "\n";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["LAST_POST"];
r += ": ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["BUMPED_AT"];
return r;
}, "flagging.delete_confirm_MF" : function(d){
var r = "";
r += "פעולה זו תסיר ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "פוסט <b>אחד</b>";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b> פוסטים";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["he"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ו";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "נושא <b>אחד</b>";
return r;
},
"other" : function(d){
var r = "";
r += "־<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b> נושאים";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["he"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " שנכתבו על ידי משתמש זה, תסיר את החשבון שלו, תחסום הרשמה מכתובת ה־IP <b> ‏";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["ip_address"];
r += "</b> ותוסיף את כתובת הדוא״ל שלו <b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["email"];
r += "</b> לרשימה שחורה קבועה. האם משתמש זה הוא בוודאות מפיץ זבל (ספאמר)?";
return r;
}, "posts_likes_MF" : function(d){
var r = "";
r += "לנושא זה יש ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "תגובה 1";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " תגובות";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["he"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "ration";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"low" : function(d){
var r = "";
r += "עם יחס גבוה של לייקים לפוסט";
return r;
},
"med" : function(d){
var r = "";
r += "עם יחס גבוה מאוד של לייקים לפוסט";
return r;
},
"high" : function(d){
var r = "";
r += "עם יחס גבוה בצורה יוצאת דופן של לייקים לפוסט";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_0[ k_1 ] || pf_0[ "other" ])( d );
r += "\n";
return r;
}, "admin.user.delete_all_posts_confirm_MF" : function(d){
var r = "";
r += "פעולה זו תסיר ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "פוסט אחד";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " פוסטים";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["he"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ו";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "נושא אחד";
return r;
},
"other" : function(d){
var r = "";
r += "־" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " נושאים";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["he"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ". להמשיך?";
return r;
}};
MessageFormat.locale.he = function ( n ) {
  if ( n === 1 ) {
    return "one";
  }
  return "other";
};

(function() {

  I18n.messageFormat = function(key, options) {
    var fn = I18n._compiledMFs[key];
    if (fn) {
      try {
        return fn(options);
      } catch(err) {
        return err.message;
      }
    } else {
      return 'Missing Key: ' + key;
    }
    return I18n._compiledMFs[key](options);
  };

})();

I18n.translations = {"he":{"js":{"number":{"format":{"separator":" .","delimiter":","},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"בית","two":"בתים","many":"בתים","other":"בתים"},"gb":"ג״ב","kb":"ק״ב","mb":"מ״ב","tb":"ט״ב"}}},"short":{"thousands":"{{number}} אלף","millions":"{{number}} מיליון"}},"dates":{"time":"h:mm a","time_with_zone":"h:mm a (z)","time_short_day":"ddd, HH:mm","timeline_date":"MMM YYYY","long_no_year":"D MMM, HH:mm","long_no_year_no_time":"D בMMM","full_no_year_no_time":"Do בMMMM","long_with_year":"D בMMM ‏YYYY ‏HH:mm","long_with_year_no_time":"D בMMM ‏YYYY","full_with_year_no_time":"D בMMMM ‏YYYY","long_date_with_year":"D בMMM‏ YY‏ LT","long_date_without_year":"D בMMM‏ LT","long_date_with_year_without_time":"D בMMM ‏YY","long_date_without_year_with_linebreak":"D בMMM‏ \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"D בMMM‏ YY‏ \u003cbr/\u003eLT","wrap_ago":"לפני %{date}","tiny":{"half_a_minute":"פחות מדקה","less_than_x_seconds":{"one":"פחות משנייה","two":"פחות מ־%{count} שניות","many":"פחות מ־%{count} שניות","other":"פחות מ־%{count} שניות"},"x_seconds":{"one":"שנייה אחת","two":"%{count} שניות","many":"%{count} שניות","other":"%{count} שניות"},"less_than_x_minutes":{"one":"פחות מדקה","two":"פחות מ־%{count} דקות","many":"פחות מ־%{count} דקות","other":"פחות מ־%{count} דקות"},"x_minutes":{"one":"דקה אחת","two":"%{count} דקות","many":"%{count} דקות","other":"%{count} דקות"},"about_x_hours":{"one":"שעה אחת","two":"שעתיים","many":"%{count} שעות","other":"%{count} שעות"},"x_days":{"one":"יום","two":"יומיים","many":"%{count} ימים","other":"%{count} ימים"},"x_months":{"one":"חודש","two":"חודשיים","many":"%{count} חודשים","other":"%{count} חודשים"},"about_x_years":{"one":"שנה","two":"שנתיים","many":"%{count} שנים","other":"%{count} שנים"},"over_x_years":{"one":"יותר משנה","two":"יותר משנתיים","many":"יותר מ־%{count} שנים","other":"יותר מ־%{count} שנים"},"almost_x_years":{"one":"שנה","two":"שנתיים","many":"%{count} שנים","other":"%{count} שנים"},"date_month":"D בMMM","date_year":"MMM YY"},"medium":{"x_minutes":{"one":"דקה","two":"%{count} דקות","many":"%{count} דקות","other":"%{count} דקות"},"x_hours":{"one":"שעה","two":"שעתיים","many":"%{count} שעות","other":"%{count} שעות"},"x_days":{"one":"יום","two":"יומיים","many":"%{count} ימים","other":"%{count} ימים"},"date_year":"D בMMM‏ YY"},"medium_with_ago":{"x_minutes":{"one":"לפני דקה","two":"לפני %{count} דקות","many":"לפני %{count} דקות","other":"לפני %{count} דקות"},"x_hours":{"one":"לפני שעה","two":"לפני שעתיים","many":"לפני %{count} שעות","other":"לפני %{count} שעות"},"x_days":{"one":"אתמול","two":"שלשום","many":"לפני %{count} ימים","other":"לפני %{count} ימים"},"x_months":{"one":"לפני חודש","two":"לפני חודשיים","many":"לפני %{count} חודשים","other":"לפני %{count} חודשים"},"x_years":{"one":"לפני שנה","two":"לפני שנתיים","many":"לפני %{count} שנים","other":"לפני %{count} שנים"}},"later":{"x_days":{"one":"יום לאחר מכן","two":"כעבור יומיים","many":"כעבור %{count} ימים","other":"כעבור %{count} ימים"},"x_months":{"one":"חודש לאחר מכן","two":"כעבור חודשיים","many":"כעבור %{count} חודשים","other":"כעבור %{count} חודשים"},"x_years":{"one":"שנה לאחר מכן","two":"כעבור שנתיים","many":"כעבור %{count} שנים","other":"כעבור %{count} שנים"}},"previous_month":"חודש קודם","next_month":"חודש הבא","placeholder":"תאריך"},"share":{"topic_html":"נושא: \u003cspan class=\"topic-title\"\u003e%{topicTitle}\u003c/span\u003e","post":"פוסט מס׳ %{postNumber}","close":"סגירה","twitter":"שיתוף קישור זה ב־Twitter","facebook":"שיתוף קישור זה ב־Facebook","email":"שיתוף קישור זה בדוא״ל"},"action_codes":{"public_topic":"נושא זה הפך לציבורי ב־%{when}","private_topic":"נושא זה הפך להודעה פרטית ב־%{when}","split_topic":"נושא זה פוצל ב־%{when}","invited_user":"נשלחה הזמנה אל %{who} ב־%{when}","invited_group":"נשלחה הזמנה אל %{who} ב־%{when}","user_left":"%{who} הסירו עצמם מהודעה זו %{when}","removed_user":"התבצעה הסרה של %{who} ב־%{when}","removed_group":"%{who} הוסר ב־%{when}","autobumped":"הוקפץ אוטומטית ב־%{when}","autoclosed":{"enabled":"נסגר ב־%{when}","disabled":"נפתח ב־%{when}"},"closed":{"enabled":"נסגר ב־%{when}","disabled":"נפתח ב־%{when}"},"archived":{"enabled":"עבר לארכיון ב־%{when}","disabled":"יצא מהארכיון ב־%{when}"},"pinned":{"enabled":"ננעץ ב־%{when}","disabled":"נעיצה בוטלה ב־%{when}"},"pinned_globally":{"enabled":"ננעץ גלובלית ב־%{when}","disabled":"נעיצה בוטלה ב־%{when}"},"visible":{"enabled":"נכנס לרשימה ב־%{when}","disabled":"הוצא מהרשימה ב־%{when}"},"banner":{"enabled":"באנר זה נוצר ב־%{when}. הוא יופיע בראש כל דף עד שישוחרר על ידי המשתמש/ת.","disabled":"באנר זה הוסר ב־%{when}. הוא לא יופיע יותר בראש כל דף."},"forwarded":"העברת ההודעה שלעיל"},"topic_admin_menu":"פעולות על נושא","wizard_required":"ברוך בואך ל־Discourse החדש שלך! נתחיל עם \u003ca href='%{url}' data-auto-route='true'\u003eאשף ההתקנה\u003c/a\u003e ✨","emails_are_disabled":"כל הדוא״ל היוצא נוטרל באופן גורף על ידי מנהל אתר. שום הודעת דוא״ל, מכל סוג שהוא, לא תשלח.","bootstrap_mode_enabled":"כדי להקל על הקמת האתר החדש שלך, כרגע המערכת במצב אתחול ראשוני. לכל המשתמשים החדשים תוענק דרגת האמון 1 ויישלח אליהם תמצות יומי בדוא״ל. אפשרות זו תכבה אוטומטית לאחר הצטרפות של למעלה מ־%{min_users} משתמשים.","bootstrap_mode_disabled":"מצב Bootstrap יבוטל תוך 24 שעות.","themes":{"default_description":"בררת מחדל","broken_theme_alert":"יתכן שהאתר שלך לא יתפקד כיוון שבערכת העיצוב / הרכיב %{theme} יש שגיאות. יש להשבית את אלה תחת %{path}."},"s3":{"regions":{"ap_northeast_1":"אסיה ומדינות האוקיינוס השקט (טוקיו)","ap_northeast_2":"אסיה ומדינות האוקיינוס השקט (סיאול)","ap_south_1":"אסיה ומדינות האוקיינוס השקט (מומבאי)","ap_southeast_1":"אסיה ומדינות האוקיינוס השקט (סינגפור)","ap_southeast_2":"אסיה ומדינות האוקיינוס השקט (סידני)","ca_central_1":"קנדה (מרכז)","cn_north_1":"סין (בייג׳ינג)","cn_northwest_1":"סין (נינגשיה)","eu_central_1":"האיחוד האירופי (פרנקפורט)","eu_north_1":"אירופה (שטוקהולם)","eu_west_1":"אירופה (אירלנד)","eu_west_2":"אירופה (לונדון)","eu_west_3":"אירופה (פריז)","sa_east_1":"אמריקה הדרומית (סאו פאולו)","us_east_1":"מזרח ארה״ב (צפון וירג׳יניה)","us_east_2":"מזרח ארה״ב (אוהיו)","us_gov_east_1":"הענן הממשלתי של AWS (ארה״ב-מערב)","us_gov_west_1":"הענן הממשלתי של AWS (מערב ארה״ב)","us_west_1":"מערב ארה״ב (צפון קליפורניה)","us_west_2":"מערב ארה״ב (אורגון)"}},"edit":"עריכת הכותרת והקטגוריה של נושא זה","expand":"הרחב","not_implemented":"תכונה זו עדיין לא מומשה, עמך הסליחה!","no_value":"לא","yes_value":"כן","submit":"שליחה","generic_error":"ארעה שגיאה, עמך הסליחה.","generic_error_with_reason":"ארעה שגיאה: %{error}","go_ahead":"קדימה","sign_up":"הרשמה","log_in":"כניסה","age":"גיל","joined":"הצטרפות","admin_title":"ניהול","show_more":"להציג עוד","show_help":"אפשרויות","links":"קישורים","links_lowercase":{"one":"קישור","two":"קישורים","many":"קישורים","other":"קישורים"},"faq":"שאלות נפוצות","guidelines":"הנחיות","privacy_policy":"מדיניות פרטיות","privacy":"פרטיות","tos":"תנאי השירות","rules":"חוקים","conduct":"נהלי התנהגות","mobile_view":"תצוגת נייד","desktop_view":"תצוגת מחשב","you":"אני","or":"או","now":"ממש עכשיו","read_more":"המשך קריאה","more":"להרחבה","less":"צמצום","never":"אף פעם","every_30_minutes":"כל 30 דקות","every_hour":"כל שעה","daily":"יומית","weekly":"שבועית","every_month":"כל חודש","every_six_months":"כל שישה חודשים","max_of_count":"{{count}} לכל היותר","alternation":"או","character_count":{"one":"תו אחד","two":"{{count}} תווים","many":"{{count}} תווים","other":"{{count}} תווים"},"related_messages":{"title":"הודעות קשורות","see_all":"להציג את \u003ca href=\"%{path}\"\u003eכל ההודעות\u003c/a\u003e מאת ‎@%{username}‎…"},"suggested_topics":{"title":"נושאים מוצעים","pm_title":"הודעות מוצעות"},"about":{"simple_title":"על אודות","title":"על אודות %{title}","stats":"סטטיסטיקות אתר","our_admins":"המנהלים שלנו","our_moderators":"המפקחים שלנו","moderators":"מפקחים","stat":{"all_time":"כל הזמנים","last_7_days":"7 הימים האחרונים","last_30_days":"30 הימים האחרונים"},"like_count":"לייקים","topic_count":"נושאים","post_count":"פוסטים","user_count":"משתמשים","active_user_count":"משתמשים פעילים","contact":"יצירת קשר","contact_info":"במקרה של בעיה קריטית או דחופה המשפיעה על אתר זה, נא ליצור אתנו קשר דרך: %{contact_info}."},"bookmarked":{"title":"סימנייה","clear_bookmarks":"מחיקת סימניות","help":{"bookmark":"יש ללחוץ כדי ליצור סימנייה לפוסט הראשון בנושא זה","unbookmark":"יש ללחוץ כדי להסיר את כל הסימניות בנושא זה","unbookmark_with_reminder":"יש ללחוץ כדי להסיר את כל הסימניות והתזכורות בנושא הזה. יש לך תזכורת שמוגדרת ל־%{reminder_at} עבור הנושא הזה."}},"bookmarks":{"created":"פוסט זה נוסף לסימניות","not_bookmarked":"סמנו פוסט זה עם סימנייה","created_with_reminder":"סימנת את הפוסט הזה עם תזכורת %{date}","created_with_at_desktop_reminder":"סימנת את הפוסט הזה ותישלח לך תזכורת בעת השימוש הבא בשולחן העבודה שלך","remove":"הסרה מהסימניות","delete":"מחיקת סימנייה","confirm_delete":"למחוק את הסימנייה הזאת? גם התזכורת תימחק.","confirm_clear":"לנקות את כל הסימניות מנושא זה?","save":"שמירה","no_timezone":"עדיין לא הגדרת אזור זמן. לא תהיה לך אפשרות להגדיר תזכורות. ניתן להגדיר אותו \u003ca href=\"%{basePath}/my/preferences/profile\"\u003eבפרופיל שלך\u003c/a\u003e.","invalid_custom_datetime":"התאריך והשעה שסיפקת שגויים, נא לנסות שוב.","list_permission_denied":"אין לך הרשאה לצפות בסימניות של המשתמש הזה.","reminders":{"at_desktop":"בשימוש הבא דרך שולחן העבודה","later_today":"בהמשך היום","next_business_day":"יום העסקים הבא","tomorrow":"מחר","next_week":"בשבוע הבא","later_this_week":"בהמשך השבוע","start_of_next_business_week":"יום שני הבא","next_month":"חודש הבא","custom":"תאריך ושעה מותאמים אישית","last_custom":"האחרון","none":"לא נדרשת תזכורת","today_with_time":"היום ב־%{time}","tomorrow_with_time":"מחר ב־%{time}","at_time":"ב־%{date_time}","existing_reminder":"הגדרת תזכורת שתישלח עבור הסימנייה הזאת"}},"drafts":{"resume":"המשך","remove":"הסרה","new_topic":"טיוטת נושא חדשה","new_private_message":"טיוטת הודעה פרטית חדשה","topic_reply":"טיוטת תשובה","abandon":{"confirm":"כבר קיימת טיוטה בנושא זה. לנטוש אותה?","yes_value":"כן, לנטוש","no_value":"לא, שמור"}},"topic_count_latest":{"one":"הצגת נושא {{count}} חדש או עדכני","two":"הצגת {{count}} נושאים חדשים או עדכניים","many":"הצגת {{count}} נושאים חדשים או עדכניים","other":"הצגת {{count}} נושאים חדשים או עדכניים"},"topic_count_unread":{"one":"הצגת נושא {{count}} שלא נקרא","two":"הצגת {{count}} נושאים שלא נקראו","many":"הצגת {{count}} נושאים שלא נקראו","other":"הצגת {{count}} נושאים שלא נקראו"},"topic_count_new":{"one":"הצגת נושא {{count}} חדש","two":"הצגת {{count}} נושאים חדשים","many":"הצגת {{count}} נושאים חדשים","other":"הצגת {{count}} נושאים חדשים"},"preview":"תצוגה מקדימה","cancel":"ביטול","save":"שמירת השינויים","saving":"בהליכי שמירה...","saved":"נשמר!","upload":"העלאה","uploading":"בהליכי העלאה...","uploading_filename":"מעלה: {{filename}}...","clipboard":"לוח","uploaded":"הועלה!","pasting":"מדביק...","enable":"לאפשר","disable":"לנטרל","continue":"המשך","undo":"לבטל פעולה","revert":"להחזיר","failed":"נכשל","switch_to_anon":"כניסה למצב אלמוני","switch_from_anon":"יציאה ממצב אלמוני","banner":{"close":"שחרור באנר זה.","edit":"עריכת הבאנר הזה \u003e\u003e"},"pwa":{"install_banner":"\u003ca href\u003eלהתקין את %{title} על המכשיר הזה?\u003c/a\u003e"},"choose_topic":{"none_found":"לא נמצאו נושאים.","title":{"search":"חיפוש אחר נושא","placeholder":"נא להקליד כאן את כותרת הנושא, הכתובת או את המזהה"}},"choose_message":{"none_found":"לא נמצאו הודעות.","title":{"search":"חיפוש אחר הודעה","placeholder":"נא להקליד כאן את כותרת ההודעה, הכתובת או את המזהה"}},"review":{"order_by":"סידור לפי","in_reply_to":"בתגובה ל","explain":{"why":"נא להסביר למה הפריט הזה הגיע לתור","title":"ניקוד שניתן לסקירה","formula":"נוסחה","subtotal":"סכום ביניים","total":"סה״כ","min_score_visibility":"ניקוד מזערי כדי שיופיע","score_to_hide":"ניקוד להסתרת הפוסט","take_action_bonus":{"name":"ננקטה פעולה","title":"כאשר חבר סגל בוחר לנקוט בפעולה הדגל מקבל בונוס."},"user_accuracy_bonus":{"name":"דיוק משתמש","title":"משתמשים שסימון הדגל שלהם קיבל הסכמה בעבר מקבלים בונוס."},"trust_level_bonus":{"name":"דרגת אמון","title":"לפריטים לסקירה שנוצרו על ידי משתמשים בדרגות אמון גבוהות יותר יש ניקוד גבוה יותר."},"type_bonus":{"name":"בונוס סוג","title":"לסוגים מסוימים של פריטים לסקירה ניתן להקצות בונוס על ידי הסגל כדי שהעדיפות שלהם תעלה."}},"claim_help":{"optional":"באפשרותך לדרוש את הפריט כדי למנוע מאחרים לסקור אותו.","required":"עליך לדרוש פריטים לפני שיתאפשר לך לסקור אותם.","claimed_by_you":"דרשת את הפריט הזה ועכשיו יתאפשר לך לסקור אותו.","claimed_by_other":"הפריט הזה זמין לסריקה רק על ידי \u003cb\u003e{{username}}\u003c/b\u003e."},"claim":{"title":"דרישת פריט זה"},"unclaim":{"help":"הסרת דרישה זו"},"awaiting_approval":"בהמתנה לאישור","delete":"הסרה","settings":{"saved":"נשמר","save_changes":"שמירת השינויים","title":"הגדרות","priorities":{"title":"עדיפויות ניתנות לסקירה"}},"moderation_history":"היסטוריית פעילות פיקוח","view_all":"להציג הכול","grouped_by_topic":"קיבוץ לפי נושא","none":"אין פריטים לסקירה.","view_pending":"הצגת ממתינים","topic_has_pending":{"one":"לנושא זה יש פוסט \u003cb\u003eאחד\u003c/b\u003e שממתין לאישור","two":"לנושא זה יש \u003cb\u003e{{count}}\u003c/b\u003e פוסטים שממתינים לאישור","many":"לנושא זה יש \u003cb\u003e{{count}}\u003c/b\u003e פוסטים שממתינים לאישור","other":"לנושא זה יש \u003cb\u003e{{count}}\u003c/b\u003e פוסטים שממתינים לאישור"},"title":"סקירה","topic":"נושא:","filtered_topic":"סיננת לתוכן שממתין לסקירה בנושא מסוים.","filtered_user":"משתמש","show_all_topics":"להציג את כל הנושאים","deleted_post":"(פוסט נמחק)","deleted_user":"(משתמש נמחק)","user":{"bio":"קורות חיים","website":"אתר","username":"שם משתמש","email":"דוא״ל","name":"שם","fields":"שדות"},"user_percentage":{"summary":{"one":"{{agreed}}, {{disagreed}}, {{ignored}} (דגל אחד סה״כ)","two":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} דגלים סה״כ)","many":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} דגלים סה״כ)","other":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} דגלים סה״כ)"},"agreed":{"one":"{{count}}% מסכים","two":"{{count}}% מסכימים","many":"{{count}}% מסכימים","other":"{{count}}% מסכימים"},"disagreed":{"one":"{{count}}% חולק","two":"{{count}}% חולקים","many":"{{count}}% חולקים","other":"{{count}}% חולקים"},"ignored":{"one":"{{count}}% מתעלם","two":"{{count}}% מתעלמים","many":"{{count}}% מתעלמים","other":"{{count}}% מתעלמים"}},"topics":{"topic":"נושא","reviewable_count":"ספירה","reported_by":"דווח ע״י","deleted":"[נושא נמחק]","original":"(נושא מקורי)","details":"פרטים","unique_users":{"one":"משתמש אחד","two":"{{count}} משתמשים","many":"{{count}} משתמשים","other":"{{count}} משתמשים"}},"replies":{"one":"תגובה אחת","two":"{{count}} תגובות","many":"{{count}} תגובות","other":"{{count}} תגובות"},"edit":"עריכה","save":"שמירה","cancel":"ביטול","new_topic":"אישור הפריט הזה ייצור נושא חדש","filters":{"all_categories":"(כל הקטגוריות)","type":{"title":"סוג","all":"(כל הסוגים)"},"minimum_score":"ניקוד מזערי","refresh":"רענון","status":"מצב","category":"קטגוריה","orders":{"priority":"עדיפות","priority_asc":"עדיפות (הפוכה)","created_at":"מועד יצירה","created_at_asc":"מועד יצירה (הפוך)"},"priority":{"title":"עדיפות מזערית","low":"(כלשהו)","medium":"בינונית","high":"גבוהה"}},"conversation":{"view_full":"הצגת הדיון המלא"},"scores":{"about":"ניקוד זה מחושב בהתאם לדרגת האמון של המדווח, הדיוק בסימונים הקודמים ועדיפות הפריט המדווח.","score":"ניקוד","date":"תאריך","type":"סוג","status":"מצב","submitted_by":"הוגש על ידי","reviewed_by":"נסקר על ידי"},"statuses":{"pending":{"title":"בהמתנה"},"approved":{"title":"אושר"},"rejected":{"title":"נדחה"},"ignored":{"title":"זכה להתעלמות"},"deleted":{"title":"נמחק"},"reviewed":{"title":"(כל אלו שנסקרו)"},"all":{"title":"(הכול)"}},"types":{"reviewable_flagged_post":{"title":"פוסט שדוגל","flagged_by":"דוגל על ידי"},"reviewable_queued_topic":{"title":"נושא בתור"},"reviewable_queued_post":{"title":"הוספת פוסט לתור"},"reviewable_user":{"title":"משתמש"}},"approval":{"title":"הפוסט זקוק לאישור","description":"הפוסט התקבל אך הוא נתון לאישור מפקח בטרם הצגתו. נא להתאזר בסבלנות.","pending_posts":{"one":"יש לך פוסט \u003cstrong\u003eאחד\u003c/strong\u003e ממתין.","two":"יש לך \u003cstrong\u003e{{count}}\u003c/strong\u003e פוסטים ממתינים.","many":"יש לך \u003cstrong\u003e{{count}}\u003c/strong\u003e פוסטים ממתינים.","other":"יש לך \u003cstrong\u003e{{count}}\u003c/strong\u003e פוסטים ממתינים."},"ok":"אישור"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e פרסם \u003ca href='{{topicUrl}}'\u003eאת הנושא\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eאת/ה\u003c/a\u003e פרסמת \u003ca href='{{topicUrl}}'\u003eאת הנושא\u003c/a\u003e","user_replied_to_post":"התקבלה תגובה מאת \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e על: \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eהגבת\u003c/a\u003e על: \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e הגיב \u003ca href='{{topicUrl}}'\u003eלנושא הזה\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eהגבת\u003c/a\u003e \u003ca href='{{topicUrl}}'\u003eלנושא הזה\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e הזכיר/ה את \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e הזכיר/ה \u003ca href='{{user2Url}}'\u003eאותך\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eאת/ה\u003c/a\u003e הזכרת את \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"פורסם על ידי \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"פורסם על \u003ca href='{{userUrl}}'\u003eידך\u003c/a\u003e","sent_by_user":"נשלח על ידי \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"נשלח \u003ca href='{{userUrl}}'\u003eעל ידך\u003c/a\u003e"},"directory":{"filter_name":"סינון לפי שם משתמש","title":"משתמשים","likes_given":"הוענקו","likes_received":"התקבלו","topics_entered":"נצפה","topics_entered_long":"נושאים שנצפו","time_read":"זמן קריאה","topic_count":"נושאים","topic_count_long":"נושאים שנוצרו","post_count":"תגובות","post_count_long":"תגובות שפורסמו","no_results":"לא נמצאו תוצאות","days_visited":"ביקורים","days_visited_long":"ימים לביקור","posts_read":"נקראו","posts_read_long":"פוסטים שנקראו","last_updated":"עדכון אחרון:","total_rows":{"one":"משתמש/ת %{count}","two":"%{count} משתמשים","many":"%{count} משתמשים","other":"%{count} משתמשים"}},"group_histories":{"actions":{"change_group_setting":"שינוי הגדרות קבוצה","add_user_to_group":"הוספת משתמש/ת","remove_user_from_group":"הסרת משתמש/ת","make_user_group_owner":"הפיכה לבעלים","remove_user_as_group_owner":"שלילת בעלות"}},"groups":{"member_added":"הוסיף","member_requested":"בקשה התקבלה ב־","add_members":{"title":"הוספת חברים","description":"נהל את החברות של קבוצה זו","usernames":"שמות משתמשים"},"requests":{"title":"בקשות","reason":"סיבה","accept":"אישור","accepted":"התקבל","deny":"דחייה","denied":"נדחה","undone":"הבקשה נמשכה","handle":"טיפול בבקשות חברות"},"manage":{"title":"ניהול","name":"שם","full_name":"שם מלא","add_members":"הוספת חברים","delete_member_confirm":"להסיר את ‚%{username}’ מהקבוצה ‚%{group}’?","profile":{"title":"פרופיל"},"interaction":{"title":"אינטראקציה","posting":"מפרסם","notification":"התראה"},"membership":{"title":"חברות","access":"גישה"},"logs":{"title":"יומנים","when":"מתי","action":"פעולה","acting_user":"משתמש פועל","target_user":"משתמש מטרה","subject":"נושא","details":"פרטים","from":"מאת","to":"אל"}},"public_admission":"אפשרו למשתמשים להצטרף לקבוצה בחופשיות (דורש קבוצה פומבית)","public_exit":"אפשרו למשתמשים לעזוב את הקבוצה בחופשיות","empty":{"posts":"אין פוסטים של חברי קבוצה זו.","members":"אין חברים בקבוצה זו.","requests":"אין בקשות חברות בקבוצה זו.","mentions":"אין איזכורים של קבוצה זו.","messages":"אין הודעות לקבוצה זו.","topics":"אין נושאים שנוצרו על ידי חברים של קבוצה זו.","logs":"אין יומנים עבור קבוצה זו."},"add":"הוספה","join":"הצטרף","leave":"עזוב","request":"בקשה","message":"הודעה","confirm_leave":"לעזוב את הקבוצה הזאת?","allow_membership_requests":" לאפשר למשתמשים לשלוח בקשות חברות לבעלי הקבוצה (נדרשת קבוצה גלויה לכלל)","membership_request_template":"תבנית מותאמת אישית שתוצג למשתמשים בעת שליחת בקשת חברות","membership_request":{"submit":"הגשת בקשה","title":"בקש להצטרף ל%{group_name}","reason":"תן לבעלי הקבוצה לדעת למה אתה שייך לקבוצה זו"},"membership":"חברות","name":"שם","group_name":"שם הקבוצה","user_count":"משתמשים","bio":"על הקבוצה","selector_placeholder":"נא להקליד שם משתמש","owner":"בעלים","index":{"title":"קבוצות","all":"כל הקבוצות","empty":"אין קבוצות נראות.","filter":"סינון לפי סוג קבוצה","owner_groups":"קבוצות שבבעלותי","close_groups":"קבוצות סגורות","automatic_groups":"קבוצות אוטומטיות","automatic":"אוטומטי","closed":"סגורה","public":"ציבורי","private":"פרטי","public_groups":"קבוצות ציבוריות","automatic_group":"קבוצה אוטומטית","close_group":"קבוצה סגורה","my_groups":"הקבוצות שלי","group_type":"סוג קבוצה","is_group_user":"חבר","is_group_owner":"בעלים"},"title":{"one":"קבוצה","two":"קבוצות","many":"קבוצות","other":"קבוצות"},"activity":"פעילות","members":{"title":"חברים","filter_placeholder_admin":"שם משתמש או כתובת דוא״ל","filter_placeholder":"שם משתמש","remove_member":"הסרת חבר","remove_member_description":"להסיר את \u003cb\u003e%{username}\u003c/b\u003e מקבוצה זו","make_owner":"הסבה לבעלים","make_owner_description":"הסבה של \u003cb\u003e%{username}\u003c/b\u003e לבעלים של קבוצה זו","remove_owner":"הסרת בעלות","remove_owner_description":"הסרת הבעלות של \u003cb\u003e%{username}\u003c/b\u003e על קבוצה זו","owner":"בעלות","forbidden":"אין לך הרשאות לצפות ברשימת החברים."},"topics":"נושאים","posts":"פוסטים","mentions":"אזכורים","messages":"הודעות","notification_level":"ברירת מחדל של רמת התראות להודעות קבוצה","alias_levels":{"mentionable":"מי יכול @להזכיר קבוצה זו","messageable":"מי יכול לשלוח הודעות בקבוצה זו","nobody":"אף אחד","only_admins":"רק מנהלים","mods_and_admins":"רק מפקחים ומנהלים","members_mods_and_admins":"רק חברי הקבוצה, מפקחים ומנהלים","owners_mods_and_admins":"בעלי קבוצות, המפקחים והמנהלים","everyone":"כולם"},"notifications":{"watching":{"title":"במעקב","description":"תקבלו התראה על כל פוסט חדש במסגרת כל הודעה, וסך התשובות יוצג."},"watching_first_post":{"title":"צפייה בפוסט הראשון","description":"תקבל התראה עבור הודעות חדשות בקבוצה זו אבל לא לתגובות עליהן."},"tracking":{"title":"במעקב","description":"תקבלו התראה אם מישהו מזכיר את @שמכם או עונה לכם, ותופיע ספירה של תגובות חדשות."},"regular":{"title":"רגיל","description":"תקבלו התראה אם מישהו מזכיר את @שמכם או עונה לכם."},"muted":{"title":"מושתק","description":"לא תקבלו הודעה על כל הקשור להודעות בקבוצה זו."}},"flair_url":"תמונת תג לדמות","flair_url_placeholder":"(רשות) כתובת של תמונה או מחלקה של Font Awesome","flair_url_description":"השתמש בתמונות בצורת ריבוע לא קטנות יותר מ20 פיקסלים על 20 פיקסלים או אייקונים של FontAwsome (פורמטים מקובלים: \"fa-icon\", \"far fa-icon\" או \"fab fa-icon\").","flair_bg_color":"צבע רקע של תג לדמות","flair_bg_color_placeholder":"(רשות) ערך הקסדצימלי של הצבע","flair_color":"צבע תג לדמות","flair_color_placeholder":"(רשות) ערך הקסדצימלי של הצבע","flair_preview_icon":"תצוגה מקדימה של סמל","flair_preview_image":"תצוגה מקדימה של תמונה"},"user_action_groups":{"1":"לייקים שהוענקו","2":"לייקים שהתקבלו","3":"סימניות","4":"נושאים","5":"תשובות","6":"תגובות","7":"אזכורים","9":"ציטוטים","11":"עריכות","12":"פריטים שנשלחו","13":"דואר נכנס","14":"ממתין","15":"טיוטות"},"categories":{"all":"כל הקטגוריות","all_subcategories":"הכול","no_subcategory":"ללא","category":"קטגוריה","category_list":"הצגת רשימת קטגוריות","reorder":{"title":"שינוי סדר קטגוריות","title_long":"סידור רשימת הקטגוריות מחדש","save":"שמירת הסדר","apply_all":"החלה","position":"מיקום"},"posts":"פוסטים","topics":"נושאים","latest":"לאחרונה","latest_by":"לאחרונה על ידי","toggle_ordering":"שינוי בקר סדר","subcategories":"תתי קטגוריות","topic_sentence":{"one":"נושא אחד","two":"%{count} נושאים","many":"%{count} נושאים","other":"%{count} נושאים"},"topic_stat_sentence_week":{"one":"נושא חדש %{count} בשבוע האחרון","two":"%{count} נושאים חדשים בשבוע האחרון","many":"%{count} נושאים חדשים בשבוע האחרון","other":"%{count} נושאים חדשים בשבוע האחרון"},"topic_stat_sentence_month":{"one":"נושא חדש %{count} בחודש האחרון","two":"%{count} נושאים חדשים בחודש האחרון","many":"%{count} נושאים חדשים בחודש האחרון","other":"%{count} נושאים חדשים בחודש האחרון"},"n_more":"קטגוריות (%{count} נוספות)…"},"ip_lookup":{"title":"חיפוש כתובת IP","hostname":"שם שרת","location":"מיקום","location_not_found":"(לא ידוע)","organisation":"ארגון","phone":"טלפון","other_accounts":"חשבונות נוספים עם כתובת IP זו:","delete_other_accounts":"מחיקה %{count}","username":"שם משתמש","trust_level":"דרגת-אמון","read_time":"זמן צפייה","topics_entered":"כניסה לנושאים","post_count":"# פוסטים","confirm_delete_other_accounts":"להסיר חשבונות אלו?","powered_by":"משתמש \u003ca href='https://maxmind.com'\u003eMaxMindDB\u003c/a\u003e","copied":"הועתק"},"user_fields":{"none":"(בחרו אפשרות)"},"user":{"said":"{{username}}:","profile":"פרופיל","mute":"השתקה","edit":"עריכת העדפות","download_archive":{"button_text":"להוריד הכל","confirm":"להוריד את הפוסטים שלך?","success":"ההורדה החלה, תישלח אליך הודעה עם סיום התהליך.","rate_limit_error":"ניתן להוריד פוסטים פעם אחת ביום, נא לנסות שוב מחר."},"new_private_message":"הודעה חדשה","private_message":"הודעה","private_messages":"הודעות","user_notifications":{"ignore_duration_title":"מתזמן התעלמות","ignore_duration_username":"שם משתמש","ignore_duration_when":"משך:","ignore_duration_save":"התעלמות","ignore_duration_note":"נא לשים לב שכל ההתעלמויות נמחקות אוטומטית לאחר שמשך ההתעלמות פג.","ignore_duration_time_frame_required":"נא לבחור מסגרת זמנים","ignore_no_users":"אין לך משתמשים ברשימת ההתעלמות.","ignore_option":"זכה להתעלמות","ignore_option_title":"לא יגיעו אליך התראות שקשורות למשתמש הזה וכל הנושאים שנכתבו על ידיו לרבות התגובות יוסתרו.","add_ignored_user":"הוספה…","mute_option":"מושתק","mute_option_title":"לא תגענה אליך התראות בנוגע למשתמש זה.","normal_option":"רגיל","normal_option_title":"תגיע אליך התראה אם המשתמש הזה יגיב לך, יצטט אותך או יאזכר אותך."},"activity_stream":"פעילות","preferences":"העדפות","feature_topic_on_profile":{"open_search":"נא לבחור נושא חדש","title":"נא לבחור נושא","search_label":"חיפוש אחר נושא לפי כותרת","save":"שמירה","clear":{"title":"ניקוי","warning":"למחוק את הנושאים המומלצים שלך?"}},"use_current_timezone":"להשתמש באזור הזמן הנוכחי","profile_hidden":"הפרופיל הציבורי של משתמש זה מוסתר","expand_profile":"הרחב","collapse_profile":"הקטן","bookmarks":"סימניות","bio":"אודותיי","timezone":"אזור זמן","invited_by":"הוזמנו על ידי","trust_level":"דרגת אמון","notifications":"התראות","statistics":"סטטיסטיקות","desktop_notifications":{"label":"התראות","not_supported":"התראות לא נתמכות בדפדפן זה. מצטערים.","perm_default":"הפעלת התראות","perm_denied_btn":"הרשאות נדחו","perm_denied_expl":"דחית הרשאה לקבלת התראות. יש לאפשר התראות בהגדרות הדפדפן שלך.","disable":"כבוי התראות","enable":"אפשר התראות","each_browser_note":"הערה: עליך לשנות הגדרה זו עבור כל דפדפן בנפרד.","consent_prompt":"האם ברצונך לקבל התראות כשאנשים מגיבים לפוסטים שלך?"},"dismiss":"דחה","dismiss_notifications":"בטלו הכל","dismiss_notifications_tooltip":"סימון כל ההתראות שלא נקראו כהתראות שנקראו","first_notification":"התראה ראשונה! בחרו אותה כדי להתחיל.","dynamic_favicon":"הצגת ספירה בסמל הדפדפן","theme_default_on_all_devices":"הגדרת ערכת עיצוב זו כבררת המחדל לכל המכשירים שלי","text_size_default_on_all_devices":"הפוך את גודל הטקסט הזה לברירת המחדל בכל המכשירים שלי","allow_private_messages":"אפשר למשתמשים אחרים לשלוח לי הודעות פרטיות","external_links_in_new_tab":"פתיחת כל הקישורים החיצוניים בלשונית חדשה","enable_quoting":"הפעלת תגובת ציטוט לטקסט מסומן","enable_defer":"הפעלת דחייה לאחר כך כדי לסמן נושאים כלא נקראו","change":"שנה","featured_topic":"נושא מומלץ","moderator":"ל־{{user}} יש תפקיד פיקוח","admin":"{{user}} הוא מנהל מערכת","moderator_tooltip":"משתמש זה הוא מפקח","admin_tooltip":"משתמש זה הינו אדמיניסטרטור","silenced_tooltip":"משתמש זה מושתק","suspended_notice":"המשתמש הזה מושעה עד לתאריך: {{date}}.","suspended_permanently":"משתמש זה מושעה.","suspended_reason":"הסיבה: ","github_profile":"GitHub","email_activity_summary":"סיכום פעילות","mailing_list_mode":{"label":"מצב רשימת תפוצה","enabled":"אפשר מצב רשימת תפוצה","instructions":"הגדרה זו דורסת את הגדרת „סיכום פעילות”.\u003cbr /\u003e\nנושאים וקטגוריות שהושתקו לא יופיעו בהודעות דוא״ל אלו.\n","individual":"לשלוח לי דוא״ל על כל פוסט חדש","individual_no_echo":"לשלוח לי דוא״ל על כל פוסט חדש מלבד שלי","many_per_day":"לשלוח לי דוא״ל על כל פוסט חדש (בערך {{dailyEmailEstimate}} ביום)","few_per_day":"לשלוח לי דוא״ל על כל פוסט חדש (בערך 2 ביום)","warning":"מצב רשימת תפוצה מופעל. מצב זה משבית את הגדרות ההתראות בדוא״ל."},"tag_settings":"תגיות","watched_tags":"נצפה","watched_tags_instructions":"תעקבו באופן אוטומטי אחרי כל הנושאים עם התגיות הללו. תקבלו התראה על כל הפרסומים והנושאים החדשים. מספר הפרסומים יופיע לצד כותרת הנושא.","tracked_tags":"במעקב","tracked_tags_instructions":"אתם תעקבו אוטומטית אחר כל הנושאים עם תגיות אלו. ספירה של פוסטים חדשים תופיע ליד הנושא.","muted_tags":"מושתק","muted_tags_instructions":"אתם לא תיודעו לגבי דבר בנוגע לנושאים חדשים עם תגיות אלו, והם לא יופיעו ברשימת האחרונים.","watched_categories":"נצפה","watched_categories_instructions":"תעקבו באופן אוטומטי אחרי כל הנושאים בקטגוריות אלו. תקבלו התראה על כל הפוסטים והנושאים החדשים. מספר הפוסטים יופיע לצד כותרת הנושא.","tracked_categories":"במעקב","tracked_categories_instructions":"אתם תעקבו אוטומטית אחר כל הנושאים עם קטגוריות אלו. ספירה של פוסטים חדשים תופיע ליד הנושא.","watched_first_post_categories":"צפייה בפוטס הראשון","watched_first_post_categories_instructions":"אתם תיודעו לגבי הפוסט הראשון בכל נושא חדש בקטגוריות אלו.","watched_first_post_tags":"צפייה בפוסט ראשון","watched_first_post_tags_instructions":"אתם תיודעו לגבי הפוסט הראשון בכל נושא חדש בתגיות אלו.","muted_categories":"מושתק","muted_categories_instructions":"לא תקבל הודעה בנוגע לנושאים חדשים בקטגוריות אלה, והם לא יופיעו בקטגוריות או בדפים האחרונים.","muted_categories_instructions_dont_hide":"לא תישלחנה אליך התראות על שום דבר בנוגע לנושאים בקטגוריות האלו.","no_category_access":"בתור פיקוח יש לך גישה מוגבלת לקטגוריות, שמירה מנוטרלת.","delete_account":"מחיקת החשבון שלי","delete_account_confirm":"להסיר את החשבון? לא ניתן לבטל פעולה זו!","deleted_yourself":"החשבון שלך נמחק בהצלחה.","delete_yourself_not_allowed":"נא לפנות לחבר סגל אם ברצונך למחוק את החשבון שלך.","unread_message_count":"הודעות","admin_delete":"מחיקה","users":"משתמשים","muted_users":"מושתק","muted_users_instructions":"להשבית כל התראה ממשתמשים אלו","ignored_users":"זכה להתעלמות","ignored_users_instructions":"הדחקת כל הפוסטים וההתראות מהמשתמשים האלה.","tracked_topics_link":"הצגה","automatically_unpin_topics":"בטל נעיצת נושאים באופן אוטומטי כאשר אני מגיע/ה לתחתית.","apps":"אפליקציות","revoke_access":"שלילת גישה","undo_revoke_access":"ביטול שלילת גישה","api_approved":"אושרו:","api_last_used_at":"שימוש אחרון:","theme":"ערכת עיצוב","home":"דף בית ברירת מחדל","staged":"מבוים","staff_counters":{"flags_given":"דגלים שעוזרים","flagged_posts":"פסטים מדוגלים","deleted_posts":"פוסטים שנמחקו","suspensions":"השעיות","warnings_received":"אזהרות","rejected_posts":"פוסטים שנדחו"},"messages":{"all":"הכל","inbox":"דואר נכנס","sent":"נשלח","archive":"ארכיון","groups":"הקבוצות שלי","bulk_select":"בחר הודעות","move_to_inbox":"העברה לדואר נכנס","move_to_archive":"ארכיון","failed_to_move":"בעיה בהעברת ההודעות שנבחרו (אולי יש תקלה בהתחברות?)","select_all":"לבחור הכול","tags":"תגיות"},"preferences_nav":{"account":"חשבון","profile":"פרופיל","emails":"כתובות דוא״ל","notifications":"התראות","categories":"קטגוריות","users":"משתמשים","tags":"תגיות","interface":"מנשק","apps":"יישומים"},"change_password":{"success":"(דואר אלקטרוני נשלח)","in_progress":"(שולח דואר אלקטרוני)","error":"(שגיאה)","emoji":"אמוג׳י של מנעול","action":"שלח דואר אלקטרוני לשחזור סיסמה","set_password":"הזן סיסמה","choose_new":"בחרו סיסמה חדשה","choose":"בחרו סיסמה"},"second_factor_backup":{"title":"קודי גיבוי ב2 גורמים","regenerate":"חדש","disable":"בטל","enable":"הפעל","enable_long":"הפעל קודי גיבוי","manage":"ניהול קודים כגיבוי. נותרו לרשותך \u003cstrong\u003e{{count}}\u003c/strong\u003e קודים כגיבוי.","copied_to_clipboard":"הועתק ללוח","copy_to_clipboard_error":"שגיאה בהעתקת מידע ללוח","remaining_codes":"יש לך \u003cstrong\u003e{{count}}\u003c/strong\u003e קודי גיבוי נותרים","use":"להשתמש בקוד גיבוי","enable_prerequisites":"עליך להפעיל אימות דו־שלבי עיקרי בטרם יצירת קודים כגיבוי.","codes":{"title":"קודי גיבוי נוצרו","description":"בכל אחד מהקודים האלו המיועדים לשחזור ניתן להשתמש רק פעם אחת. מוטב לשמור עליהם במקום בטוח אך נגיש."}},"second_factor":{"title":"אימות ב2 גורמים","enable":"ניהול אימות דו־שלבי","forgot_password":"שכחת את הססמה?","confirm_password_description":"אנא אשר את סיסמתך בכדי להמשיך","name":"שם","label":"קוד","rate_limit":"אנא המתינו לפני שתנסו קוד אישור אחר.","enable_description":"יש לסרוק את קוד ה־QR הזה ביישומון נתמך (\u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target=\"_blank\"\u003eAndroid\u003c/a\u003e – \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\" target=\"_blank\"\u003eiOS\u003c/a\u003e) ולהקליד את קוד האימות שלך.\n","disable_description":"נא למלא את קוד האישור מהיישומון שלך","show_key_description":"הכנס ידנית","short_description":"הגנה על החשבון שלך עם קודים חד־פעמיים לאבטחה.\n","extended_description":"אימות ב2 גורמים מחזק את אבטחת המשתמש שלך על ידי אסימון אבטחה חד-פעמי בנוסף לסיסמה שלך. ניתן ליצור אסימונים על מכשיריAndroid\u003c/a\u003e ו\u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\"\u003eiOS\u003c/a\u003e.\n","oauth_enabled_warning":"לידיעתך, כניסות מרשתות חברתיות ינוטרלו לאחר הפעלת אימות בשני שלבים בחשבונך.","use":"להשתמש ביישומון אימות","enforced_notice":"עליך להפעיל אימות דו־שלבי בטרם הגישה לאתר הזה.","disable":"נטרול","disable_title":"נטרול אימות דו־שלבי","disable_confirm":"לנטרל את כל האימותים הדו־שלביים?","edit":"עריכה","edit_title":"עריכת אימות דו־שלבי","edit_description":"שם אימות דו־שלבי","enable_security_key_description":"כשמפתח האבטחה הפיזי שלך מוכן יש ללחוץ על כפתור הרישום שלהלן.","totp":{"title":"מאמתים מבוססי אסימונים","add":"מאמת חדש","default_name":"המאמת שלי","name_and_code_required_error":"עליך לספק שם וקוד מיישומון האימות שלך."},"security_key":{"register":"הרשמה","title":"מפתחות אבטחה","add":"רישום מפתח אבטחה","default_name":"מפתח אבטחה עיקרי","not_allowed_error":"זמן תהליך רישום מפתח האבטחה פג או שבוטל.","already_added_error":"כבר רשמת את מפתח האבטחה הזה. אין צורך לרשום אותו שוב.","edit":"עריכת מפתח אבטחה","edit_description":"שם מפתח אבטחה","delete":"מחיקה","name_required_error":"עליך לציין שם למפתח האבטחה שלך."}},"change_about":{"title":"שינוי בנוגע אליי","error":"ארעה שגיאה בשינוי ערך זה."},"change_username":{"title":"שנה שם משתמש","confirm":"האם את/ה בטוח/ה שברצונך לשנות את שם המשתמש/ת שלך?","taken":"סליחה, שם המשתמש הזה תפוס.","invalid":"שם המשתמש אינו תקין. עליו לכלול רק אותיות באנגלית ומספרים."},"change_email":{"title":"שנה דואר אלקטרוני","taken":"סליחה, הכתובת הזו אינה זמינה.","error":"הייתה שגיאה בשינוי כתובת הדואר האלקטרוני שלך. אולי היא תפוסה?","success":"שלחנו דואר אלקטרוני לכתובת הדואר הזו. בבקשה עיקבו אחרי הוראות האישור שם.","success_staff":"שלחנו דואר אלקטרוני לכתובת הדואר הזו. אנא עיקבו אחרי הוראות האישור."},"change_avatar":{"title":"שינוי תמונת הפרופיל","gravatar":"\u003ca href='//{{gravatarBaseUrl}}{{gravatarLoginUrl}}' target='_blank'\u003e{{gravatarName}}\u003c/a\u003e, מבוסס על","gravatar_title":"החלפת הדמות שלך באתר {{gravatarName}}","gravatar_failed":"לא הצלחנו למצוא {{gravatarName}} עם כתובת הדוא״ל הזו.","refresh_gravatar_title":"רענון ה־{{gravatarName}} שלך","letter_based":"תמונת פרופיל משובצת מהמערכת","uploaded_avatar":"תמונה אישית","uploaded_avatar_empty":"הוסיפו תמונה אישית","upload_title":"העלאת התמונה שלך","image_is_not_a_square":"אזהרה: קיצצנו את התמונה שלך; האורך והרוחב לא היו שווים."},"change_profile_background":{"title":"כותרת פרופיל","instructions":"כותרות הפרופילים ימורכזו ורוחבן ייקבע ל־1110 פיקסלים כבררת מחדל."},"change_card_background":{"title":"כרטיס הרקע של המשתמש/ת","instructions":"תמונות רקע ימורכזו ויוצגו ברוחב ברירת מחדל של 590px."},"change_featured_topic":{"title":"נושא מומלץ","instructions":"קישור לנושא הזה יופיע בכרטיס המשתמש ובפרופיל שלך."},"email":{"title":"דואר אלקטרוני","primary":"כתובת דוא״ל ראשית","secondary":"כתובות דוא״ל משניות","no_secondary":"אין כתובות דוא״ל משניות","sso_override_instructions":"ניתן לעדכן את כתובת הדוא״ל דרך ספק ה־SSO.","instructions":"לעולם לא מוצג לציבור.","ok":"נשלח אליכם דואר אלקטרוני לאישור","invalid":"בבקשה הכניסו כתובת דואר אלקטרוני תקינה","authenticated":"כתובת הדואר האלקטרוני שלך אושרה על ידי {{provider}}","frequency_immediately":"נשלח לך הודעה בדוא״ל מיידית אם טרם קראת את מה ששלחנו לך קודם.","frequency":{"one":"נשלח לך הודעה בדוא״ל רק אם לא הופעת בדקה האחרונה.","two":"נשלח לך הודעה בדוא״ל רק אם לא הופעת ב־{{count}} הדקות האחרונות.","many":"נשלח לך הודעה בדוא״ל רק אם לא הופעת ב־{{count}} הדקות האחרונות.","other":"נשלח לך הודעה בדוא״ל רק אם לא הופעת ב־{{count}} הדקות האחרונות."}},"associated_accounts":{"title":"חשבונות מקושרים","connect":"התחבר","revoke":"בטל","cancel":"ביטול","not_connected":"(לא מחובר)","confirm_modal_title":"חיבור חשבון %{provider}","confirm_description":{"account_specific":"החשבון שלך ‚%{account_description}’ ב־%{provider} ישמש לאימות.","generic":"החשבון של אצל %{provider} ישמש לאימות."}},"name":{"title":"שם","instructions":"שמך המלא (רשות)","instructions_required":"שמך המלא","too_short":"השם שלך קצר מידי","ok":"השם נראה טוב"},"username":{"title":"שם משתמש/ת","instructions":"ייחודי, ללא רווחים, קצר","short_instructions":"אנשים יכולים לאזכר אותך כ @{{username}}","available":"שם המשתמש שלך פנוי","not_available":"לא זמין. נסו {{suggestion}}?","not_available_no_suggestion":"לא זמין","too_short":"שם המשתמש שלך קצר מידי","too_long":"שם המשתמש שלך ארוך מידי","checking":"בודק זמינות שם משתמש...","prefilled":"הדואר האלקטרוני תואם לשם משתמש זה"},"locale":{"title":"שפת ממשק","instructions":"שפת ממשק המשתמש. היא תתחלף כשתרעננו את העמוד.","default":"(ברירת מחדל)","any":"כלשהו"},"password_confirmation":{"title":"סיסמה שוב"},"invite_code":{"title":"קוד הזמנה","instructions":"רישום חשבון דורש קוד הזמנה"},"auth_tokens":{"title":"מכשירים שהיו בשימוש לאחרונה","ip":"IP","details":"פרטים","log_out_all":"להוציא את כולם","active":"פעיל עכשיו","not_you":"לא אתה?","show_all":"הצג הכל ({{count}})","show_few":"הצג פחות","was_this_you":"האם זה היית אתה?","was_this_you_description":"אם לא נכנסת למערכת, אנו ממליצים לך לשנות את ססמתך ולהוציא את המשתמש בכל מקום שניתן.","browser_and_device":"{{browser}} ב{{device}}","secure_account":"אבטח את החשבון שלי","latest_post":"פרסמת לאחרונה..."},"last_posted":"פוסט אחרון","last_emailed":"נשלח לאחרונה בדואר אלקטרוני","last_seen":"נראה","created":"הצטרפו","log_out":"יציאה","location":"מיקום","website":"אתר","email_settings":"דואר אלקטרוני","hide_profile_and_presence":"הסתר את מאפייני הפרופיל והנוכחות שלי","enable_physical_keyboard":"הפעלת תמיכה במקלדת פיזית ב־iPad","text_size":{"title":"גודל טקסט","smaller":"קטן יותר","normal":"רגיל","larger":"גדול יותר","largest":"גדול ביותר"},"title_count_mode":{"title":"כותרת החלון כשהוא ברקע מייצגת את הספירה של:","notifications":"התראות חדשות","contextual":"תוכן חדש בדף"},"like_notification_frequency":{"title":"התראה כשנאהב","always":"תמיד","first_time_and_daily":"בפעם הראשונה שמישהו אוהב פוסט ומידי יום","first_time":"בפעם הראשונה שמישהו אוהב פוסט","never":"אף פעם"},"email_previous_replies":{"title":"לכלול תגובות קודמות בתחתית הודעות הדוא״ל","unless_emailed":"אלא אם נשלח לפני כן","always":"תמיד","never":"אף פעם"},"email_digests":{"title":"כשלא ביקרתי כאן תקופה, נא לשלוח לי סיכום בדוא״ל של נושאים ותגובות נפוצים","every_30_minutes":"מידי 30 דקות","every_hour":"שעתי","daily":"יומית","weekly":"שבועית","every_month":"כל חודש","every_six_months":"כל שישה חודשים"},"email_level":{"title":"נא לשלוח לי דוא״ל כשמצטטים אותי, מגיבים לפוסט שלי, מזכירים את @שם-המשתמש שלי, או מזמינים אותי לנושא","always":"תמיד","only_when_away":"רק בזמן העדרות","never":"אף פעם"},"email_messages_level":"נא לשלוח לי דוא״ל כשכשנשלחות אלי הודעות","include_tl0_in_digests":"לכלול תכנים ממשתמשים חדשים בהודעות סיכום בדוא״ל","email_in_reply_to":"לכלול ציטוטים מתגובות לפוסטים בתוכן הדוא״ל","other_settings":"אחר","categories_settings":"קטגוריות","new_topic_duration":{"label":"נושא יחשב כנושא חדש כאשר","not_viewed":"עוד לא ראיתי אותם","last_here":"נוצרו מאז הביקור האחרון שלי כאן","after_1_day":"נוצר ביום האחרון","after_2_days":"נוצר במהלך היומיים האחרונים","after_1_week":"נוצר במהלך השבוע האחרון","after_2_weeks":"נוצר בשבועיים האחרונים"},"auto_track_topics":"מעקב אוטומטי אחר נושאים אליהם נכנסתי","auto_track_options":{"never":"אף פעם","immediately":"מיידי","after_30_seconds":"אחרי 30 שניות","after_1_minute":"אחרי דקה","after_2_minutes":"אחרי שתי דקות","after_3_minutes":"אחרי 3 דקות","after_4_minutes":"אחרי 4 דקות","after_5_minutes":"אחרי 5 דקות","after_10_minutes":"אחרי 10 דקות"},"notification_level_when_replying":"כאשר אני מפרסם נושא, קבע נושא זה ל","invited":{"search":"הקלידו כדי לחפש הזמנות...","title":"הזמנות","user":"משתמשים שהוזמנו","sent":"שליחה אחרונה","none":"אין הזמנות להצגה","truncated":{"one":"מראה את ההזמנה הראשונה.","two":"מראה את {{count}} ההזמנות הראשונות.","many":"מראה את {{count}} ההזמנות הראשונות.","other":"מראה את {{count}} ההזמנות הראשונות."},"redeemed":"הזמנות נוצלו","redeemed_tab":"נענו","redeemed_tab_with_count":"נוצלו ({{count}})","redeemed_at":"נפדו ב","pending":"הזמנות ממתינות","pending_tab":"ממתין","pending_tab_with_count":"ממתינות ({{count}})","topics_entered":"נושאים נצפו","posts_read_count":"פוסטים נקראו","expired":"פג תוקף ההזמנה.","rescind":"הסרה","rescinded":"הזמנה הוסרה","rescind_all":"הסרת כל ההזמנות שתוקפן פג","rescinded_all":"כל ההזמנות שתוקפן פג הוסרו!","rescind_all_confirm":"להסיר את כל ההזמנות שתוקפן פג?","reinvite":"משלוח חוזר של הזמנה","reinvite_all":"שלח מחדש את כל ההזמנות","reinvite_all_confirm":"לשלוח מחדש את כל ההזמנות?","reinvited":"ההזמנה נשלחה שוב","reinvited_all":"כל ההזמנות נשלחו מחדש!","time_read":"זמן קריאה","days_visited":"מספר ימי ביקור","account_age_days":"גיל החשבון בימים","create":"שליחת הזמנה","generate_link":"העתקת קישור הזמנה","link_generated":"קישור הזמנה יוצר בהצלחה!","valid_for":"קישור ההזמנה תקף רק לכתובת דוא״ל זו: %{email}","bulk_invite":{"none":"עדיין לא הזמנתם לכאן אף אחד. שילחו הזמנות אישיות, או הזמינו הרבה אנשים ביחד על ידי \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003eהעלאת קובץ CSV\u003c/a\u003e.","text":"הזמנה קבוצתית מקובץ","success":"העלאת הקובץ החלה בהצלחה, תקבלו התראה באמצעות מסר כאשר התהליך יושלם.","error":"מצטערים, לקובץ צריך להיות פורמט CSV","confirmation_message":"פעולה זו תשלח הזמנות בדוא״ל לכל מי שבקובץ שהועלה."}},"password":{"title":"סיסמה","too_short":"הסיסמה שלך קצרה מידי.","common":"הסיסמה הזו נפוצה מידי.","same_as_username":"הסיסמה שלך זהה לשם המשתמש/ת שלך.","same_as_email":"הססמה שלך זהה לכתובת הדוא״ל שלך.","ok":"הסיסמה שלך נראית טוב.","instructions":"לפחות %{count} תווים"},"summary":{"title":"סיכום","stats":"סטטיסטיקות","time_read":"זמן קריאה","recent_time_read":"זמן קריאה אחרון","topic_count":{"one":"נושא נוצר","two":"נושאים נוצרו","many":"נושאים נוצרו","other":"נושאים נוצרו"},"post_count":{"one":"פוסט נוצר","two":"פוסטים נוצרו","many":"פוסטים נוצרו","other":"פוסטים נוצרו"},"likes_given":{"one":"ניתן","two":"ניתנו","many":"ניתנו","other":"ניתנו"},"likes_received":{"one":"התקבל","two":"התקבלו","many":"התקבלו","other":"התקבלו"},"days_visited":{"one":"יום שבוקר","two":"ימים שבוקרו","many":"ימים שבוקרו","other":"ימים שבוקרו"},"topics_entered":{"one":"נושא נצפה","two":"נושאים נצפו","many":"נושאים נצפו","other":"נושאים נצפו"},"posts_read":{"one":"פוסט נקרא","two":"פוסטים נקראו","many":"פוסטים נקראו","other":"פוסטים נקראו"},"bookmark_count":{"one":"סימנייה","two":"סימניות","many":"סימניות","other":"סימניות"},"top_replies":"תגובות מובילות","no_replies":"עדיין אין תגובות.","more_replies":"תגובות נוספות","top_topics":"נושאים מובילים","no_topics":"אין נושאים עדיין.","more_topics":"נושאים נוספים","top_badges":"עיטורים מובילים","no_badges":"עדיין בלי עיטורים.","more_badges":"עיטורים נוספים","top_links":"קישורים מובילים","no_links":"עדיין ללא קישורים.","most_liked_by":"נאהב ביותר על-ידי","most_liked_users":"נאהב ביותר","most_replied_to_users":"הכי הרבה נענו","no_likes":"עדיין אין לייקים.","top_categories":"קטגוריות מובילות","topics":"נושאים","replies":"תגובות"},"ip_address":{"title":"כתובת IP אחרונה"},"registration_ip_address":{"title":"כתובת IP בהרשמה"},"avatar":{"title":"תמונת פרופיל","header_title":"פרופיל, הודעות, סימניות והעדפות"},"title":{"title":"כותרת","none":"(ללא)"},"primary_group":{"title":"קבוצה ראשית","none":"(ללא)"},"filters":{"all":"הכל"},"stream":{"posted_by":"פורסם על ידי","sent_by":"נשלח על ידי","private_message":"הודעה","the_topic":"הנושא"}},"loading":"טוען...","errors":{"prev_page":"בזמן הניסיון לטעון","reasons":{"network":"שגיאת רשת","server":"שגיאת שרת","forbidden":"גישה נדחתה","unknown":"תקלה","not_found":"העמוד לא נמצא"},"desc":{"network":"נא לבדוק את החיבור שלך.","network_fixed":"נראה שזה חזר לעבוד.","server":"קוד שגיאה: {{status}}","forbidden":"אינכם רשאים לצפות בזה.","not_found":"אופס, ניסינו לטעון עמוד שאיננו קיים.","unknown":"משהו השתבש."},"buttons":{"back":"חזרה","again":"ניסיון נוסף","fixed":"טעינת עמוד"}},"modal":{"close":"סגירה","dismiss_error":"התעלמות מהשגיאה"},"close":"סגור","assets_changed_confirm":"האתר עבר עדכון. תרצו לרענן לגרסה המתקדמת ביותר?","logout":"יצאת מהמערכת.","refresh":"רענן","read_only_mode":{"enabled":"אתר זה נמצא במצב קריאה בלבד. אנא המשיכו לשוטט, אך תגובות, לייקים, ופעולות נוספות כרגע אינם מאופשרים.","login_disabled":"הכניסה מנוטרלת בזמן שהאתר במצב קריאה בלבד.","logout_disabled":"היציאה מנוטרלת בזמן שהאתר במצב של קריאה בלבד."},"logs_error_rate_notice":{},"learn_more":"למד עוד...","all_time":"סך הכל","all_time_desc":"כל הנושאים שנוצרו","year":"שנה","year_desc":"נושאים שפורסמו ב-365 הימים האחרונים","month":"חודש","month_desc":"נושאים שפורסמו ב-30 הימים האחרונים","week":"שבוע","week_desc":"נושאים שפורסמו ב-7 הימים האחרונים","day":"יום","first_post":"פוסט ראשון","mute":"השתק","unmute":"ביטול השתקה","last_post":"פורסמו","time_read":"נקרא","time_read_recently":"%{time_read} לאחרונה","time_read_tooltip":"%{time_read} זמן צפייה כולל","time_read_recently_tooltip":"%{time_read} זמן צפייה כולל (%{recent_time_read} ב60 הימים האחרונים)","last_reply_lowercase":"תגובה אחרונה","replies_lowercase":{"one":"תגובה","two":"תגובות","many":"תגובות","other":"תגובות"},"signup_cta":{"sign_up":"הרשמה","hide_session":"הזכר לי מחר","hide_forever":"לא תודה","hidden_for_session":"סבבה, השאלה תופיע מחר. תמיד ניתן להשתמש ב‚כניסה’ גם כדי ליצור חשבון.","intro":"שלום! נראה שאתם נהנים מהדיון, אבל לא נרשמתם לחשבון עדיין.","value_prop":"בעת יצירת החשבון, אנו זוכרים במדויק מה קראת, לכן תמיד יתאפשר לך לחזור להיכן שהפסקת. נוסף על כך, יישלחו אליך התראות, כאן ודרך דוא״ל כשמתקבלת תגובה על משהו שכתבת. יש לך גם אפשרות לסמן לייק פוסטים שאהבת כדי להוסיף ולהפיץ אהבה. :heartpulse:"},"summary":{"enabled_description":"אתם צופים בסיכום נושא זה: הפוסטים המעניינים ביותר כפי שסומנו על ידי הקהילה.","description":"ישנן \u003cb\u003e{{replyCount}}\u003c/b\u003e תגובות.","description_time":"יש \u003cb\u003e{{replyCount}}\u003c/b\u003e תגובות עם זמן קריאה מוערך של \u003cb\u003e{{readingTime}} דקות\u003c/b\u003e.","enable":"סכם נושא זה","disable":"הצג את כל הפוסטים"},"deleted_filter":{"enabled_description":"נושא זה מכיל פוסטים שנמחקו ולכן אינם מוצגים.","disabled_description":"פוסטים שנמחקו בנושא זה מוצגים כעת.","enable":"הסתרת פוסטים שנמחקו","disable":"הצגת פוסטים שנמחקו"},"private_message_info":{"title":"הודעה","invite":"הזמינו אחרים...","edit":"הוספה או הסרה…","leave_message":"האם אתה באמת רוצה לעזוב את ההודעה הזו?","remove_allowed_user":"להסיר את {{name}} מהודעה זו?","remove_allowed_group":"להסיר את {{name}} מהודעה זו?"},"email":"דוא״ל","username":"שם משתמש","last_seen":"נצפה","created":"נוצר","created_lowercase":"נוצר/ו","trust_level":"דרגת אמון","search_hint":"שם משתמש, דוא״ל או כתובת IP","create_account":{"disclaimer":"עצם הרשמתך מביעה את הסכמתך ל\u003ca href='{{privacy_link}}' target='blank'\u003eמדיניות הפרטיות\u003c/a\u003e ול\u003ca href='{{tos_link}}' target='blank'\u003eתנאי השירות\u003c/a\u003e.","title":"יצירת חשבון חדש","failed":"משהו לא בסדר, אולי כבר קיימת כתובת דואר אלקטרוני כזו. נסו את קישור שכחתי סיסמה."},"forgot_password":{"title":"אתחול סיסמה","action":"שכחתי את ססמתי","invite":"נא להקליד את שם המשתמש וכתובת הדוא״ל שלך ואנו נשלח לך הודעה בדוא״ל לאיפוס ססמה.","reset":"איפוס ססמה","complete_username":"אם קיים חשבון שמתאים לשם המשתמש \u003cb\u003e%{username}\u003c/b\u003e, תוך זמן קצר אמורה להגיע אליך הודעה בדוא״ל עם הנחיות לאיפוס הססמה שלך.","complete_email":"אם החשבון מתאים לכתובת \u003cb\u003e%{email}\u003c/b\u003e, תוך זמן קצר אמורה להגיע אליך הודעה בדוא״ל עם הנחיות לאיפוס הססמה שלך.","complete_username_found":"מצאנו חשבון שתואם לשם המשתמש \u003cb\u003e%{username}\u003c/b\u003e. תוך זמן קצר אמורה להגיע לדוא״ל שלך הודעה עם הנחיות כיצד לאפס את הססמה שלך.","complete_email_found":"מצאנו חשבון שתואם לכתובת \u003cb\u003e%{email}\u003c/b\u003e. תוך זמן קצר אמורה להגיע לדוא״ל שלך הודעה עם הנחיות כיצד לאפס את הססמה שלך.","complete_username_not_found":"שום חשבון אינו תואם לשם המשתמש \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"שום חשבון אינו תואם ל \u003cb\u003e%{email}\u003c/b\u003e","help":"ההודעה אינה מגיעה אליך לתיבת הדוא״ל? נא לבדוק את תיקיית הזבל/ספאם קודם.\u003cp\u003eלא ברור לך באיזו כתובת דוא״ל השתמשת? נא להקליד כתובת דוא״ל ואנו ניידע אותך אם היא קיימת כאן.\u003c/p\u003e\u003cp\u003eאם כבר אין לך גישה לכתובת הדוא״ל של החשבון שלך, נא ליצור קשר עם \u003ca href='%{basePath}/about'\u003eהסגל המועיל שלנו.\u003c/a\u003e\u003c/p\u003e","button_ok":"או קיי","button_help":"עזרה"},"email_login":{"link_label":"נא לשלוח לי קישור לכניסה בדוא״ל","button_label":"עם דוא״ל","emoji":"אמוג׳י של מנעול","complete_username":"אם קיים חשבון שמתאים לשם המשתמש \u003cb\u003e%{username}\u003c/b\u003e, בקרוב אמורה להגיע אליך הודעה בדוא״ל עם קישור כניסה למערכת.","complete_email":"אם קיים חשבון שמתאים ל־\u003cb\u003e%{email}\u003c/b\u003e, בקרוב אמורה להגיע אליך הודעה בדוא״ל עם קישור כניסה למערכת.","complete_username_found":"נמצא חשבון תואם לשם המשתמש \u003cb\u003e%{username}\u003c/b\u003e, בקרוב תגיע אליך הודעה בדוא״ל עם קישור לכניסה.","complete_email_found":"נמצא חשבון תואם לשם \u003cb\u003e%{username}\u003c/b\u003e, בקרוב תגיע אליך הודעה בדוא״ל עם קישור לכניסה.","complete_username_not_found":"שום חשבון אינו תואם לשם המשתמש \u003cb\u003e%{username}\u003c/b\u003e","complete_email_not_found":"שום חשבון אינו תואם ל \u003cb\u003e%{email}\u003c/b\u003e","confirm_title":"להמשיך אל %{site_name}","logging_in_as":"מתבצעת כניסה בתור %{email}","confirm_button":"סיום הכניסה"},"login":{"title":"כניסה","username":"משתמש","password":"סיסמה","second_factor_title":"אימות ב2 גורמים","second_factor_description":"נא למלא את קוד האישור מהיישומון שלך:","second_factor_backup":"כניסה עם קוד גיבוי","second_factor_backup_title":"גיבוי דו־שלבי","second_factor_backup_description":"נא להקליד אחד מהקודים לגיבוי שלך:","second_factor":"כניסה עם יישומון אימות","security_key_description":"כשמפתח האבטחה הפיזי שלך מוכן יש ללחוץ על כפתור האימות עם מפתח האבטחה שלהלן.","security_key_alternative":"לנסות דרך אחרת","security_key_authenticate":"אימות עם מפתח אבטחה","security_key_not_allowed_error":"זמן תהליך אימות מפתח האבטחה פג או שבוטל.","security_key_no_matching_credential_error":"לא ניתן למצוא פרטי גישה במפתח האבטחה שסופק.","security_key_support_missing_error":"המכשיר או הדפדפן הנוכחי שלך לא תומך בשימוש במפתחות אבטחה, נא להשתמש בשיטה אחרת.","email_placeholder":"דואר אלקטרוני או שם משתמש/ת","caps_lock_warning":"מקש Caps Lock לחוץ","error":"שגיאה לא ידועה","cookies_error":"כנראה שהעוגיות בדפדפן שלך מנוטרלות. אין אפשרות להיכנס מבלי להפעיל אותן.","rate_limit":"נא להמתין בטרם ביצוע ניסיון כניסה חוזר.","blank_username":"נא למלא כתובת דוא״ל או שם משתמש.","blank_username_or_password":"נא למלא את כתובת הדוא״ל או את שם המשתמש שלך וססמה.","reset_password":"אפס סיסמה","logging_in":"מתחבר....","or":"או","authenticating":"מאשר...","awaiting_activation":"החשבון שלך ממתין להפעלה, נא להשתמש בקישור „שכחתי ססמה” כדי לשלוח הודעת הפעלה נוספת.","awaiting_approval":"החשבון שלך טרם אושר על ידי חבר סגל. תישלח אליך הודעה בדוא״ל כשהוא יאושר.","requires_invite":"סליחה, גישה לפורום הזה היא בהזמנה בלבד.","not_activated":"אינך יכול להתחבר עדיין. שלחנו לך דואר אלקטרוני להפעלת החשבון לכתובת: \u003cb\u003e{{sentTo}}\u003c/b\u003e. יש לעקוב אחר ההוראות בדואר כדי להפעיל את החשבון.","not_allowed_from_ip_address":"הכניסה מכתובת IP זו אסורה.","admin_not_allowed_from_ip_address":"הכניסה לניהול מכתובת IP זו אסורה.","resend_activation_email":"יש ללחוץ כאן לשליחת דואר אלקטרוני חוזר להפעלת החשבון.","omniauth_disallow_totp":"בחשבון שלך מופעל אימות ב2 גורמים. אנא התחבר עם הסיסמה שלך.","resend_title":"שליחה מחדש של הודעת הפעלה בדוא״ל","change_email":"שינוי כתובת דוא״ל","provide_new_email":"נא לספק כתובת חדשה ואנו נשלח מחדש בדוא״ל את הודעת האישור שלך.","submit_new_email":"עדכון כתובת דוא״ל","sent_activation_email_again":"שלחנו לך הודעת דואר אלקטרוני נוספת להפעלת החשבון לכתובת \u003cb\u003e{{currentEmail}}\u003c/b\u003e. זה יכול לקחת כמה דקות עד שיגיע, לא לשכוח לבדוק את תיבת דואר הזבל.","sent_activation_email_again_generic":"שלחנו הודעת הפעלה נוספת בדוא״ל. ייתכן שיהיה עליך להמתין מספר דקות להגעתה. מוטב לבדוק גם את תיקיית הספאם שלך.","to_continue":"נא להיכנס","preferences":"כדי לשנות את העדפות המשתמש ראשית יש להיכנס למערכת.","forgot":"אין לי את פרטי החשבון שלי","not_approved":"החשבון שלך עדיין לא אושר. תישלח אליך הודעה בדוא״ל כשיתאפשר לך להיכנס למערכת.","google_oauth2":{"name":"Google","title":"עם Google"},"twitter":{"name":"Twitter","title":"עם Twitter"},"instagram":{"name":"Instagram","title":"עם אינסטגרם"},"facebook":{"name":"Facebook","title":"עם Facebook"},"github":{"name":"GitHub","title":"עם GitHub"},"discord":{"name":"Discord","title":"עם Discord"},"second_factor_toggle":{"totp":"להשתמש ביישומון אימות במקום","backup_code":"להשתמש בקוד גיבוי במקום"}},"invites":{"accept_title":"הזמנה","emoji":"אמוג׳י של מעטפה","welcome_to":"ברוך בואך אל %{site_name}!","invited_by":"הוזמנתם על ידי:","social_login_available":"מעתה יתאפשר לך להיכנס עם כל כניסה מרשת חברתית בעזרת כתובת הדוא״ל הזאת.","your_email":"כתובת הדוא״ל של החשבון שלך היא \u003cb\u003e%{email}\u003c/b\u003e.","accept_invite":"קבלת הזמנה","success":"החשבון נוצר ונכנסת אליו.","name_label":"שם","password_label":"הגדרת ססמה","optional_description":"(רשות)"},"password_reset":{"continue":"המשיכו ל-%{site_name}"},"emoji_set":{"apple_international":"אפל/בינלאומי","google":"גוגל","twitter":"טוויטר","emoji_one":"JoyPixels (לשעבר EmojiOne)","win10":"חלונות 10","google_classic":"Google Classic","facebook_messenger":"Facebook Messenger"},"category_page_style":{"categories_only":"קטגוריות בלבד","categories_with_featured_topics":"קטגוריות עם נושאים מומלצים","categories_and_latest_topics":"קטגוריות ונושאים אחרונים","categories_and_top_topics":"קטגוריות ונושאים מובילים","categories_boxes":"תיבות עם תתי קטגוריות","categories_boxes_with_topics":"תיבות עם נושאים מומלצים"},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt","enter":"Enter"},"conditional_loading_section":{"loading":"בטעינה…"},"category_row":{"topic_count":"{{count}} נושאים בקטגוריה הזו"},"select_kit":{"default_header_text":"בחירה…","no_content":"לא נמצאו התאמות","filter_placeholder":"חיפוש...","filter_placeholder_with_any":"חיפוש או יצירה…","create":"יצירה: ‚{{content}}’","max_content_reached":{"one":"ניתן לבחור פריט אחד.","two":"ניתן לבחור {{count}} פריטים.","many":"ניתן לבחור {{count}} פריטים.","other":"ניתן לבחור {{count}} פריטים."},"min_content_not_reached":{"one":"נא לבחור בפריט אחד לפחות.","two":"נא לבחור ב־{{count}} פריטים לפחות.","many":"נא לבחור ב־{{count}} פריטים לפחות.","other":"נא לבחור ב־{{count}} פריטים לפחות."},"invalid_selection_length":"אורך הבחירה חייב להיות {{count}} תווים לפחות."},"date_time_picker":{"from":"מאת","to":"אל","errors":{"to_before_from":"תאריך היעד חייב להיות לאחר תאריך ההתחלה."}},"emoji_picker":{"filter_placeholder":"חיפוש אחר אמוג׳י","smileys_\u0026_emotion":"חייכנים ורגש","people_\u0026_body":"אנשים וגוף","animals_\u0026_nature":"חיות וטבע","food_\u0026_drink":"מזון ומשקאות","travel_\u0026_places":"טיול ומקומות","activities":"פעילויות","objects":"עצמים","symbols":"סמלים","flags":"דגלים","recent":"בשימוש לאחרונה","default_tone":"ללא גוון עור","light_tone":"גוון עור בהיר","medium_light_tone":"גוון עור בהיר בינוני","medium_tone":"גוון עור בינוני","medium_dark_tone":"גוון עור כהה בינוני","dark_tone":"גוון עור כהה","default":"אמוג׳ים מותאמים"},"shared_drafts":{"title":"טיוטות משותפות","notice":"הנושא הזה ניתן לצפייה עבור מי שיכולים לצפות בקטגורית \u003cb\u003e{{category}}\u003c/b\u003e.","destination_category":"קטגוריית יעד","publish":"פרסום טיוטה משותפת","confirm_publish":"לפרסם את הטיוטה הזו?","publishing":"נושא מתפרסם…"},"composer":{"emoji":"אמוג׳י :)","more_emoji":"עוד...","options":"אפשרויות","whisper":"לחישה","unlist":"לא-רשום","blockquote_text":"בלוק ציטוט","add_warning":"זוהי אזהרה רשמית.","toggle_whisper":"הפעלת לחישה","toggle_unlisted":"סימון/אי-סימון כלא-ברשימות","posting_not_on_topic":"לאיזה נושא רצית להגיב?","saved_local_draft_tip":"נשמר מקומית","similar_topics":"הנושא שלך דומה ל...","drafts_offline":"טיוטות מנותקות","edit_conflict":"עריכת סתירה","group_mentioned_limit":"\u003cb\u003eזהירות!\u003c/b\u003e ציינת \u003ca href='{{group_link}}'\u003e{{group}}\u003c/a\u003e, אך לקבוצה זו יש יותר חברים משהוגדר למנהל המערכת הגבלה של עד {{max}} משתמשים. אף אחד לא יקבל הודעה","group_mentioned":{"one":"על ידי אזכור {{group}}, אתם עומדים ליידע \u003ca href='{{group_link}}'\u003eאדם אחד\u003c/a\u003e – אתם בטוחים?","two":"על ידי אזכור {{group}}, אתם עומדים ליידע \u003ca href='{{group_link}}'\u003e{{count}} אנשים\u003c/a\u003e – אתם בטוחים?","many":"על ידי אזכור {{group}}, אתם עומדים ליידע \u003ca href='{{group_link}}'\u003e{{count}} אנשים\u003c/a\u003e – אתם בטוחים?","other":"על ידי אזכור {{group}}, אתם עומדים ליידע \u003ca href='{{group_link}}'\u003e{{count}} אנשים\u003c/a\u003e – אתם בטוחים?"},"cannot_see_mention":{"category":"הזכרת את {{username}} אבל לא תישלח אליו/ה התרעה עקב העדר גישה לקטגוריה זו. יהיה עליך להוסיף אותו/ה לקבוצה שיש לה גישה לקטגוריה הזו.","private":"הזכרתם את {{username}} אבל הוא/היא לא יקבלו התראה כיוון שהם לא יכולים לראות את ההודעה הפרטית הזו. תצטרכו להזמין אותם להודעה פרטית זו."},"duplicate_link":"נראה שהקישור שלך אל \u003cb\u003e{{domain}}\u003c/b\u003e כבר פורסם בנושא הזה על ידי \u003cb\u003e‎@{{username}}‎\u003c/b\u003e כ\u003ca href='{{post_url}}'\u003eתגובה ב{{ago}}\u003c/a\u003e - לפרסם אותו שוב?","reference_topic_title":"תגובה: {{title}}","error":{"title_missing":"יש להזין כותרת.","title_too_short":"על הכותרת להיות באורך {{min}} תווים לפחות.","title_too_long":"על הכותרת להיות באורך {{max}} לכל היותר.","post_missing":"הפוסט לא יכול להיות ריק","post_length":"על הפוסט להיות באורך {{min}} תווים לפחות","try_like":"האם ניסית את כפתור ה-{{heart}}?","category_missing":"עליך לבחור קטגוריה.","tags_missing":"עליך לפחות לפחות {{count}} תגיות","topic_template_not_modified":"נא להוסיף פרטים ותיאורים מדויקים לנושא שלך על ידי עריכת תבנית הנושא."},"save_edit":"שמירת עריכה","overwrite_edit":"שכתוב על עריכה","reply_original":"תגובה לנושא המקורי","reply_here":"תגובה כאן","reply":"תגובה","cancel":"ביטול","create_topic":"יצירת נושא","create_pm":"הודעה","create_whisper":"לחישה","create_shared_draft":"צור טיוטה משותפת","edit_shared_draft":"עריכת טיוטה משותפת","title":"או לחצו Ctrl+Enter","users_placeholder":"הוספת משתמש","title_placeholder":" במשפט אחד, במה עוסק הדיון הזה?","title_or_link_placeholder":"הקלידו כותרת, או הדביקו קישור כאן","edit_reason_placeholder":"מדוע ערכת?","topic_featured_link_placeholder":"הזינו קישור שיוצג עם הכותרת.","remove_featured_link":"הסר קישור מנושא","reply_placeholder":"הקלידו כאן. השתמשו ב Markdown, BBCode או HTML כדי לערוך. גררו או הדביקו תמונות.","reply_placeholder_no_images":"הקלידו כאן. השתמשו בMarkdown, BBCode או HTML כדי לערוך.","reply_placeholder_choose_category":"נא לבחור בקטגוריה בטרם תחילת ההקלדה כאן.","view_new_post":"הצגת הפוסט החדש שלך.","saving":"שומר","saved":"נשמר!","saved_draft":"טיוטה לפוסט בעריכה. נא לגעת כדי להמשיך.","uploading":"מעלה...","show_preview":"הראה תצוגה מקדימה \u0026raquo;","hide_preview":"\u0026laquo; הסתר תצוגה מקדימה","quote_post_title":"ציטוט פוסט בשלמותו","bold_label":"B","bold_title":"מודגש","bold_text":"טקסט מודגש","italic_label":"I","italic_title":"נטוי","italic_text":"טקסט נטוי","link_title":"קישור","link_description":"הזן תיאור קישור כאן","link_dialog_title":"הזן קישור","link_optional_text":"כותרת כרשות","link_url_placeholder":"יש להדביק כתובת כדי לחפש נושאים","quote_title":"ציטוט","quote_text":"ציטוט","code_title":"טקסט מעוצב","code_text":"הזחה של הטקסט ב-4 רווחים","paste_code_text":"הקלידו או הדביקו קוד כאן","upload_title":"העלאה","upload_description":"הזן תיאור העלאה כאן","olist_title":"רשימה ממוספרת","ulist_title":"רשימת נקודות","list_item":"פריט ברשימה","toggle_direction":"הפיכת כיוון","help":"עזרה על כתיבה ב-Markdown","collapse":"מזער את לוח העריכה","open":"פתח את לוח העריכה","abandon":"סגור את העורך והשלך את הטיוטה","enter_fullscreen":"היכנס לעריכה במסך מלא","exit_fullscreen":"צא מעריכה במסך מלא","modal_ok":"אישור","modal_cancel":"ביטול","cant_send_pm":"מצטערים, אינכם יכולים לשלוח הודעה ל-%{username}.","yourself_confirm":{"title":"שחכתם להוסיף נמענים?","body":"כרגע ההודעה הזו נשלחת רק אליכם!"},"admin_options_title":"אפשרויות סגל כרשות לנושא זה","composer_actions":{"reply":"השב","draft":"טיוטה","edit":"עריכה","reply_to_post":{"label":"תגובה לפוסט %{postNumber} ע\"י %{postUsername}","desc":"תגובה לפוסט ספיציפי"},"reply_as_new_topic":{"label":"תגובה כנושא מקושר","desc":"צור נושא חדש מקושר לנושא זה","confirm":"יש לך טיוטה של נושא חדש שתשוכתב בעת יציאת נושא מקושר."},"reply_as_private_message":{"label":"הודעה חדשה","desc":"צור הודעה פרטית חדשה"},"reply_to_topic":{"label":"הגב לנושא","desc":"הגב לנושא, לא פוסט ספציפי"},"toggle_whisper":{"label":"החלפת מצב לחישה","desc":"לחישות גלויות לחברי סגל בלבד"},"create_topic":{"label":"נושא חדש"},"shared_draft":{"label":"טיוטה משותפת","desc":"יצירת טיוטה לנושא שרק חברי הסגל יוכלו לראות"},"toggle_topic_bump":{"label":"החלפת מצב הקפצת נושא","desc":"הגב מבלי לשנות את תאריך התגובה האחרונה"}},"details_title":"תקציר","details_text":"טקסט זה יוסתר"},"notifications":{"tooltip":{"regular":{"one":"התראה אחת שלא נצפתה","two":"{{count}} התראות שלא נצפו","many":"{{count}} התראות שלא נצפו","other":"{{count}} התראות שלא נצפו"},"message":{"one":"הודעה אחת שלא נקראה","two":"{{count}} הודעות שלא נקראו","many":"{{count}} הודעות שלא נקראו","other":"{{count}} הודעות שלא קראו"},"high_priority":{"one":"הודעה אחת (%{count}) בדחיפות גבוהה שלא נקראה","two":"%{count} הודעות בדחיפות גבוהה שלא נקראו","many":"%{count} הודעות בדחיפות גבוהה שלא נקראו","other":"%{count} הודעות בדחיפות גבוהה שלא נקראו"}},"title":"התראות אזכור @שם, תגובות לפוסטים ולנושאים שלך, הודעות, וכו׳","none":"לא ניתן לטעון כעת התראות.","empty":"לא נמצאו התראות.","post_approved":"הפוסט שלך אושר","reviewable_items":"פריטים שדורשים סקירה","mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","group_mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","quoted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","bookmark_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","replied":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","posted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","edited":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked_2":"\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}","liked_many":{"one":"\u003cspan\u003e{{username}}, {{username2}} ו%{count} נוסף\u003c/span\u003e {{description}}","two":"\u003cspan\u003e{{username}}, {{username2}} ו{{count}} נוספים\u003c/span\u003e {{description}}","many":"\u003cspan\u003e{{username}}, {{username2}} ו{{count}} נוספים\u003c/span\u003e {{description}}","other":"\u003cspan\u003e{{username}}, {{username2}} ו{{count}} נוספים \u003c/span\u003e{{description}}"},"liked_consolidated_description":{"one":"אהבו פוסט {{count}} שלך","two":"אהבו {{count}} מהפוסטים שלך","many":"אהבו {{count}} מהפוסטים שלך","other":"אהבו {{count}} מהפוסטים שלך"},"liked_consolidated":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","private_message":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_private_message":"\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_topic":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invitee_accepted":"\u003cspan\u003e{{username}}\u003c/span\u003e אישר/ה את ההזמנה שלך","moved_post":"\u003cspan\u003e{{username}}\u003c/span\u003e עבר {{description}}","linked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","granted_badge":"הרווחת '{{description}}'","topic_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","watching_first_post":"\u003cspan\u003eנושא חדש\u003c/span\u003e {{description}}","membership_request_accepted":"התקבלת לחברות בקבוצה ‚{{group_name}}’","membership_request_consolidated":"{{count}} בקשות חברות פתוחות מול ‚{{group_name}}’","group_message_summary":{"one":"הודעה {{count}} בתיבת ה{{group_name}} שלך","two":"{{count}} הודעות בתיבת ה{{group_name}} שלך","many":"{{count}} הודעות בתיבת ה{{group_name}} שלך","other":"{{count}} הודעות בתיבת ה{{group_name}} שלך"},"popup":{"mentioned":"{{username}} הזכיר/ה אותך ב{{topic}}\" - {{site_title}}\"","group_mentioned":"הוזכרת על ידי {{username}} בנושא „{{topic}}” - {{site_title}}","quoted":"{{username}} ציטט/ה אותך ב\"{{topic}}\" - {{site_title}}","replied":"{{username}} הגיב/ה לך ב\"{{topic}}\" - {{site_title}}","posted":"{{username}} הגיב/ה ב\"{{topic}}\" - {{site_title}}","private_message":"{{username}} שלח לך הודעה פרטית ב\"{{topic}}\" - {{site_title}}","linked":"הפוסט שלך קושר על ידי {{username}} מתוך „{{topic}}” - {{site_title}}","watching_first_post":"{{username}} יצר נושא חדש \"{{topic}}\" - {{site_title}}","confirm_title":"התראות הופעלו - %{site_title}","confirm_body":"הצלחה! התראות הופעלו","custom":"התראה מ־{{username}} באתר %{site_title}"},"titles":{"mentioned":"אוזכר","replied":"תגובה חדשה","quoted":"צוטט","edited":"נערך","liked":"לייק חדש","private_message":"הודעה פרטית חדשה","invited_to_private_message":"הוזמנת להודעה פרטית","invitee_accepted":"ההזמנה התקבלה","posted":"פוסט חדש","moved_post":"פוסט הועבר","linked":"מקושר","bookmark_reminder":"תזכורת סימון","bookmark_reminder_with_name":"תזכורת סימון - %{name}","granted_badge":"הוענק עיטור","invited_to_topic":"הוזמן לנושא","group_mentioned":"קבוצה אוזכרה","group_message_summary":"הודעות קבוצתיות חדשות","watching_first_post":"נושא חדש","topic_reminder":"תזכורת נושא","liked_consolidated":"לייקים חדשים","post_approved":"פוסט אושר","membership_request_consolidated":"בקשות חברות חדשות"}},"upload_selector":{"title":"הוספת תמונה","title_with_attachments":"הוספת תמונה או קובץ","from_my_computer":"מהמחשב שלי","from_the_web":"מהאינטרנט","remote_tip":"קישור לתמונה","remote_tip_with_attachments":"קישור לתמונה או לקובץ {{authorized_extensions}}","local_tip":"בחרו תמונות ממכשירכם","local_tip_with_attachments":"בחירת תמונות או קבצים מהמכשיר שלך {{authorized_extensions}}","hint":"(ניתן גם לגרור לעורך להעלאה)","hint_for_supported_browsers":"תוכלו גם לגרור או להדביק תמונות לעורך","uploading":"מעלה","select_file":"בחירת קובץ","default_image_alt_text":"תמונה"},"search":{"sort_by":"מיון על פי","relevance":"רלוונטיות","latest_post":"הפוסטים האחרונים","latest_topic":"נושא אחרון","most_viewed":"הנצפה ביותר","most_liked":"האהובים ביותר","select_all":"בחירה של הכל","clear_all":"נקוי של הכל","too_short":"ביטוי החיפוש שלך קצר מידי.","result_count":{"one":"\u003cspan\u003eתוצאה אחת עבור\u003c/span\u003e\u003cspan class='term'\u003e {{term}}\u003c/span\u003e","two":"\u003cspan\u003e{{count}}{{plus}} תוצאות עבור\u003c/span\u003e\u003cspan class='term'\u003e {{term}}\u003c/span\u003e","many":"\u003cspan\u003e{{count}}{{plus}} תוצאות עבור\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e","other":"\u003cspan\u003e{{count}}{{plus}} תוצאות עבור \u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e"},"title":"חיפוש נושאים, פוסטים, משתמשים או קטגוריות","full_page_title":"חפש נושאים או פוסטים","no_results":"אין תוצאות.","no_more_results":"לא נמצאו עוד תוצאות.","searching":"מחפש ...","post_format":"#{{post_number}} מאת {{username}}","results_page":"חפש תוצאות עבור '{{term}}'","more_results":"יש עוד תוצאות. אנא צמצם את קריטריוני החיפוש.","cant_find":"לא מצליחים למצוא את מה שחיפשתם?","start_new_topic":"אולי תפתחו נושא חדש?","or_search_google":"או שתנסו חיפוש בעזרת גוגל במקום.","search_google":"נסה לחפש באמצעות גוגל במקום:","search_google_button":"גוגל","search_google_title":"חפש אתר זה","context":{"user":"חיפוש פוסטים לפי @{{username}}","category":"חפשו את הקטגוריה #{{category}}","tag":"חיפוש אחר התגית #{{tag}}","topic":"חפשו בנושא זה","private_messages":"חיפוש הודעות"},"advanced":{"title":"חיפוש מתקדם","posted_by":{"label":"פורסם על ידי"},"in_category":{"label":"\\"},"in_group":{"label":"בקבוצה"},"with_badge":{"label":"עם עיטור"},"with_tags":{"label":"מתוייג"},"filters":{"label":"החזר רק נושאים/פוסטים...","title":"מתאימים רק בכותרת","likes":"אהבתי","posted":"פרסמתי בהם","created":"יצרתי","watching":"אני צופה בהם","tracking":"אני עוקב אחריהם","private":"בהודעות שלי","bookmarks":"סימנתי","first":"הפוסטים הראשונים","pinned":"נעוצים","unpinned":"לא נעוצים","seen":"קראתי","unseen":"לא קראתי","wiki":"הם ויקי","images":"לרבות תמונות","all_tags":"כל התגיות הנ\"ל"},"statuses":{"label":"כאשר נושאים","open":"פתוחים","closed":"סגורים","public":"הם ציבוריים","archived":"מאורכבים","noreplies":"אין להם תגובות","single_user":"מכילים משתמש/ת יחידים"},"post":{"count":{"label":"מספר פוסטים מינימלי"},"time":{"label":"פורסמו","before":"לפני","after":"אחרי"}}}},"hamburger_menu":"עיברו לרשימת נושאים אחרת או קטגוריה","new_item":"חדש","go_back":"חזור אחורה","not_logged_in_user":"עמוד משתמש עם סיכום פעילות נוכחית והעדפות","current_user":"לך לעמוד המשתמש שלך","view_all":"להציג הכול","topics":{"new_messages_marker":"ביקור אחרון","bulk":{"select_all":"בחרו הכל","clear_all":"נקו הכל","unlist_topics":"הסרת נושאים","relist_topics":"רשימה מחדש של נושאים","reset_read":"איפוס נקראו","delete":"מחיקת נושאים","dismiss":"ביטול","dismiss_read":"בטלו את כל אלו שלא-נקראו","dismiss_button":"ביטול...","dismiss_tooltip":"ביטול הצגת פוסטים חדשים או מעקב אחר נושאים","also_dismiss_topics":"הפסיקו לעקוב אחרי נושאים אלו כדי שהם לא יופיעו שוב בתור לא-נקראו","dismiss_new":"ביטול חדשים","toggle":"החלף קבוצה מסומנת של נושאים","actions":"מקבץ פעולות","change_category":"קביעת קטגוריה","close_topics":"סגירת נושאים","archive_topics":"ארכוב נושאים","notification_level":"התראות","choose_new_category":"בחרו את הקטגוריה עבור הנושאים:","selected":{"one":"בחרת בנושא \u003cb\u003eאחד\u003c/b\u003e.","two":"בחרת ב־\u003cb\u003e{{count}}\u003c/b\u003e נושאים.","many":"בחרת ב־\u003cb\u003e{{count}}\u003c/b\u003e נושאים.","other":"בחרת ב־\u003cb\u003e{{count}}\u003c/b\u003e נושאים."},"change_tags":"החלפת תגים","append_tags":"הוספת תגים","choose_new_tags":"בחרו בתגיות חדשות עבור נושאים אלו:","choose_append_tags":"בחרו תגים חדשים להוסיף לנושאים הללו:","changed_tags":"התגיות של נושאים אלו השתנו."},"none":{"unread":"אין לך נושאים שלא נקראו.","new":"אין לך נושאים חדשים.","read":"עדיין לא קראת אף נושא.","posted":"עדיין לא פרסמתם באף נושא.","latest":"אין נושאים אחרונים. זה עצוב.","bookmarks":"אין לך עדיין סימניות לנושאים.","category":"אין נושאים בקטגוריה {{category}}.","top":"אין נושאים מובילים.","educate":{"new":"\u003cp\u003eהנושאים החדשים שלך יופיעו כאן.\u003c/p\u003e\u003cp\u003eכבררת מחדל, נושאים נחשבים חדשים ויופיעו עם המחוון \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003eחדש\u003c/span\u003e אם הם נוצרו ביומיים האחרונים \u003c/p\u003e\u003cp\u003eניתן לבקר בעמוד ה\u003ca href=\"%{userPrefsUrl}\"\u003eהעדפות\u003c/a\u003e שלך כדי לשנות זאת.\u003c/p\u003e","unread":"\u003cp\u003eהנושאים שלא קראת יופיעו כאן.\u003c/p\u003e\u003cp\u003eכבררת מחדל, נושאים ייחשבו שטרם קראת אותם ויציגו את המונה \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e בספירה של הפריטים שלא נקראו אם: \u003c/p\u003e \u003cul\u003e\u003cli\u003eיצרת את הנושא\u003c/li\u003e\u003cli\u003eהגבת לנושא\u003c/li\u003e\u003cli\u003eקראת את הנושא במשך יותר מ־4 דקות\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eאו אם בחרת לעקוב או לצפות בנושא דרך מנגנון ההתראות המופיע בתחתית כל נושא.\u003c/p\u003e\u003cp\u003eניתן לבקר ב בעמוד ה\u003ca href=\"%{userPrefsUrl}\"\u003eהעדפות\u003c/a\u003e שלך כדי לשנות זאת.\u003c/p\u003e"}},"bottom":{"latest":"אין עוד נושאים אחרונים.","posted":"אין עוד נושאים שפורסמו.","read":"אין עוד נושאים שנקראו.","new":"אין עוד נושאים חדשים.","unread":"אין עוד נושאים שלא נקראו.","category":"אין עוד נושאים בקטגוריה {{category}}.","top":"אין עוד נושאים מובילים.","bookmarks":"אין עוד סימניות לנושאים."}},"topic":{"filter_to":{"one":"פוסט אחד בנושא","two":"{{count}} פוסטים בנושא","many":"{{count}} פוסטים בנושא","other":"{{count}} פוסטים בנושא"},"create":"נושא חדש","create_long":"יצירת נושא חדש","open_draft":"פתח טיוטה","private_message":"תחילת הודעה","archive_message":{"help":"העברת הודעה לארכיון","title":"ארכב"},"move_to_inbox":{"title":"העברה לדואר נכנס","help":"החזרת הודעה לדואר נכנס"},"edit_message":{"help":"ערוך פוסט ראשון של ההודעה","title":"עריכת הודעה"},"defer":{"help":"סימון כלא נקראו","title":"אחר כך"},"feature_on_profile":{"help":"הוספת הנושא הזה לכרטיס המשתמש ולפרופיל שלך","title":"הצגה בפרופיל"},"remove_from_profile":{"warning":"בפרופיל שלך כבר יש נושא מומלץ. המשך פעולה זו תחליף את הנושא הקיים.","help":"הסרת הקישור לנושא הזה בפרופיל המשתמש שלך","title":"הסרה מהפרופיל"},"list":"נושאים","new":"נושא חדש","unread":"לא נקראו","new_topics":{"one":"נושא חדש אחד","two":"{{count}} נושאים חדשים","many":"{{count}} נושאים חדשים","other":"{{count}} נושאים חדשים"},"unread_topics":{"one":"%{count} שלא נקרא","two":"{{count}} נושאים שלא נקראו","many":"{{count}} נושאים שלא נקראו","other":"{{count}} נושאים שלא נקראו"},"title":"נושא","invalid_access":{"title":"הנושא פרטי","description":"סליחה, איך אין לך גישה לנושא הזה!","login_required":"יש להיכנס כדי לצפות בנושא זה."},"server_error":{"title":"שגיאה בטעינת הנושא","description":"סליחה, לא יכולנו לטעון את הנושא הזה, ייתכן שבשל תקלת תקשורת. אנא נסו שוב. אם הבעיה נמשכת, הודיעו לנו."},"not_found":{"title":"הנושא לא נמצא","description":"לא הצלחנו למצוא את הנושא הזה. אולי הוא הוסר על ידי הפיקוח?"},"total_unread_posts":{"one":"יש לכם פוסט אחד שלא נקרא בנושא זה","two":"יש לכם {{count}} פוסטים שלא נקראו בנושא זה","many":"יש לכם {{count}} פוסטים שלא נקראו בנושא זה","other":"יש לכם {{count}} פוסטים שלא נקראו בנושא זה"},"unread_posts":{"one":"יש לכם פוסט אחד שלא נקרא בנושא הזה","two":"יש לכם {{count}} פוסטים ישנים שלא נקראו בנושא הזה","many":"יש לכם {{count}} פוסטים ישנים שלא נקראו בנושא הזה","other":"יש לכם {{count}} פוסטים ישנים שלא נקראו בנושא הזה"},"new_posts":{"one":"יש פוסט אחד חדש בנושא הזה מאז שקראתם אותו לאחרונה","two":"יש {{count}} פוסטים חדשים בנושא זה מאז שקראתם אותו לאחרונה","many":"יש {{count}} פוסטים חדשים בנושא זה מאז שקראתם אותו לאחרונה","other":"יש {{count}} פוסטים חדשים בנושא זה מאז שקראתם אותו לאחרונה"},"likes":{"one":"יש לייק אחד בנושא הזה","two":"יש {{count}} לייקים בנושא זה","many":"יש {{count}} לייקים בנושא זה","other":"יש {{count}} לייקים בנושא זה"},"back_to_list":"חזרה לרשימת הנושאים","options":"אפשרויות נושא","show_links":"הצג קישורים בתוך הנושא הזה","toggle_information":"הצגת פרטי נושא","read_more_in_category":"רוצים לקרוא עוד? עיינו בנושאים אחרים ב {{catLink}} או {{latestLink}}.","read_more":"רוצה לקרוא עוד? {{catLink}} or {{latestLink}}.","group_request":"עליך לבקש חברות בקבוצה `{{name}}` כדי לצפות בנושא הזה","group_join":"עליך להצטרף לקבוצה `{{name}}` כדי לצפות בנושא הזה","group_request_sent":"בקשת החברות שלך נשלחה לקבוצה הזו. ניידע אותך כשהיא תתקבל.","unread_indicator":"אף אחד מהחברים לא קרא את הפוסט האחרון של הנושא הזה עדיין.","browse_all_categories":"עיינו בכל הקטגוריות","view_latest_topics":"הצגת נושאים אחרונים","suggest_create_topic":"למה לא ליצור נושא חדש?","jump_reply_up":"קפיצה לתגובה קודמת","jump_reply_down":"קפיצה לתגובה מאוחרת","deleted":"הנושא הזה נמחק","topic_status_update":{"title":"שעון עצר לנושא","save":"קביעת שעון עצר","num_of_hours":"מספר שעות:","num_of_days":"מספר הימים:","remove":"הסרת שעון עצר","publish_to":"פרסום ל:","when":"מתי:","public_timer_types":"שעוני עצר לנושא","private_timer_types":"מתזמני נושאי משתמש","time_frame_required":"נא לבחור מסגרת זמנים"},"auto_update_input":{"none":"נא לבחור טווח זמן","later_today":"בהמשך היום","tomorrow":"מחר","later_this_week":"בהמשך השבוע","this_weekend":"בסוף שבוע זה","next_week":"בשבוע הבא","two_weeks":"שבועיים","next_month":"חודש הבא","two_months":"חודשיים","three_months":"שלושה חודשים","four_months":"ארבעה חודשים","six_months":"שישה חודשים","one_year":"שנה","forever":"לנצח","pick_date_and_time":"בחרו תאריך ושעה","set_based_on_last_post":"סגירה מבוססת על הפוסט האחרון"},"publish_to_category":{"title":"תזמון פרסום"},"temp_open":{"title":"פתיחה זמנית"},"auto_reopen":{"title":"פתיחה אוטומטית של נושא"},"temp_close":{"title":"סגירה זמנית"},"auto_close":{"title":"סגירה אוטומטית של נושא","label":"שעות סגירת שעות אוטומטית:","error":"אנא הכניסו ערך תקין.","based_on_last_post":"אל תסגרו עד שהפוסט האחרון בנושא הוא לפחות בגיל זה."},"auto_delete":{"title":"מחיקה-אוטומטית של נושא"},"auto_bump":{"title":"נושא מוקפץ אוטומטית"},"reminder":{"title":"תזכורת"},"auto_delete_replies":{"title":"למחוק תגובות אוטומטית"},"status_update_notice":{"auto_open":"נושא זה ייפתח אוטומטית %{timeLeft}.","auto_close":"נושא זו ייסגר אוטומטית %{timeLeft}.","auto_publish_to_category":"נושא זה יפורסם ל-\u003ca href=%{categoryUrl}\u003e#%{categoryName}\u003c/a\u003e %{timeLeft}.","auto_close_based_on_last_post":"נושא זה ייסגר %{duration} אחרי התגובה האחרונה.","auto_delete":"נושא זה יימחק אוטומטית %{timeLeft}.","auto_bump":"נושא זה יוקפץ אוטומטית %{timeLeft}.","auto_reminder":"תישלח אליך תזכורת בנוגע לנושא זה %{timeLeft}.","auto_delete_replies":"תגובות על נושא זה נמחקות אוטומטית לאחר %{duration}."},"auto_close_title":"הגדרות סגירה אוטומטית","auto_close_immediate":{"one":"הפוסט האחרון בנושא הוא כבר בן שעה, אז הנושא ייסגר מיידית.","two":"הפוסט האחרון בנושא הוא כבר בן %{count} שעות, אז הנושא ייסגר אוטומטית.","many":"הפוסט האחרון בנושא הוא כבר בן %{count} שעות, אז הנושא ייסגר אוטומטית.","other":"הפוסט האחרון בנושא הוא כבר בן %{count} שעות, אז הנושא ייסגר אוטומטית."},"timeline":{"back":"חזרה","back_description":"חיזרו לפוסט האחרון שלא-נקרא על-ידיכם","replies_short":"%{current} / %{total}"},"progress":{"title":"התקדמות נושא","go_top":"למעלה","go_bottom":"למטה","go":"קדימה","jump_bottom":"מעבר לפוסט האחרון","jump_prompt":"קפצו אל...","jump_prompt_of":"מתוך %{count} פוסטים","jump_prompt_long":"מעבר אל…","jump_bottom_with_number":"קפיצה לפוסט %{post_number}","jump_prompt_to_date":"עד לתאריך","jump_prompt_or":"או","total":"סך הכל הפוסטים","current":"פוסט נוכחי"},"notifications":{"title":"שנו את תדירות ההתראות על הנושא הזה","reasons":{"mailing_list_mode":"מצב רשימת תפוצה פעיל, לכן תישלח אליך התראה בדוא״ל על תגובות לנושא זה.","3_10":"תקבלו התראות כיוון שאתם צופים בתג שקשור לנושא זה.","3_6":"תקבלו התראות כיוון שאתם עוקבים אחרי קטגוריה זו.","3_5":"תקבלו התראות כיוון שהתחלתם לעקוב אחרי הנושא הזה אוטומטית.","3_2":"תקבלו התראות כיוון שאתם עוקבים אחרי הנושא הזה.","3_1":"תקבלו התראות כיוון שאתם יצרתם את הנושא הזה.","3":"תקבלו התראות כיוון שאתם עוקבים אחרי הנושא זה.","2_8":"תראו ספירה של תגובות חדשות כיוון שאתם עוקבים אחר קטגוריה זו.","2_4":"תראו ספירה של תגובות חדשות כיוון שפרסמתם תגובה לנושא זה.","2_2":"תראו ספירה של תגובות חדשות כיוון שאתם עוקבים אחר נושא זה:","2":"אתם תראו ספירה של תגובות חדשות כיוון ש\u003ca href=\"{{basePath}}/u/{{username}}/preferences\"\u003eקראתם נושא זה\u003c/a\u003e.","1_2":"תישלח התראה אם מישהו יזכיר את @שם_המשתמש שלך או ישיב לך.","1":"תישלח התראה אם מישהו יזכיר את @שם_המשתמש שלך או ישיב לך.","0_7":"אתם מתעלמים מכל ההתראות בקטגוריה זו.","0_2":"אתם מתעלמים מכל ההתראות בנושא זה.","0":"אתם מתעלמים מכל ההתראות בנושא זה."},"watching_pm":{"title":"עוקב","description":"תקבלו התראה על כל תגובה חדשה בהודעה זו. בנוסף מספר התגובות שלא נקראו יופיעו ליד ההודעה."},"watching":{"title":"עוקב","description":"תקבלו התראה על כל תגובה חדשה בנושא זה ומספר התגובות החדשות יוצג. "},"tracking_pm":{"title":"עוקב","description":"ספירה של תגובות חדשות תופיע עבור הודעה זו. אתם תיודעו אם מישהו מזכיר את @שמכם או עונה לכם."},"tracking":{"title":"עוקב","description":"כמו רגיל, בנוסף מספר התגובות שלא נקראו יוצג לנושא זה."},"regular":{"title":"רגיל","description":"תישלח התראה אם מישהו יזכיר את @שם_המשתמש שלך או ישיב לך."},"regular_pm":{"title":"רגיל","description":"תישלח התראה אם מישהו יזכיר את @שם_המשתמש שלך או ישיב לך."},"muted_pm":{"title":"מושתק","description":"לעולם לא תקבלו התראה בנוגע להודעה זו."},"muted":{"title":"מושתק","description":"לעולם לא תיודעו לגבי דבר בנוגע לנושא זה, והוא לא יופיע ב״אחרונים״."}},"actions":{"title":"פעולות","recover":"שחזר נושא","delete":"מחיקת נושא","open":"פתיחת נושא","close":"סגירת נושא","multi_select":"בחרו פוסטים...","timed_update":"קביעת שעון עצר נושא...","pin":"נעיצת נושא...","unpin":"שחרור נעיצת נושא...","unarchive":"הוצאת נושא מארכיון","archive":"ארכוב נושא","invisible":"הסתרה","visible":"גילוי","reset_read":"אפס מידע שנקרא","make_public":"הפיכת הנושא לפומבי","make_private":"צור הודעה פרטית","reset_bump_date":"אפס תאריך הקפצה"},"feature":{"pin":"נעיצת נושא","unpin":"שחרור נעיצת נושא","pin_globally":"נעיצת נושא גלובלית","make_banner":"נושא באנר","remove_banner":"הסרת נושא באנר"},"reply":{"title":"תגובה","help":"התחילו לערוך תגובה לנושא זה"},"clear_pin":{"title":"נקה נעיצה","help":"לנקות את מצב הנעיצה של הנושא הזה כדי שלא יופיע עוד בראש רשימת הנושאים שלך"},"share":{"title":"שיתוף","extended_title":"שתף קישור","help":"שתפו קישור לנושא זה"},"print":{"title":"הדפסה","help":"פתיחת גרסה ידידותית להדפסה של נושא זה"},"flag_topic":{"title":"דגל","help":"דגלו נושא זה באופן פרטי לתשומת לב או שלחו התראה פרטית בנוגע אליו","success_message":"דיגלתם נושא זה בהצלחה."},"make_public":{"title":"המרה לנושא ציבורי","choose_category":"נא לבחור קטגוריה לנושא הציבורי:"},"feature_topic":{"title":"המליצו על נושא זה","pin":"גרמו לנושא זה להופיע בראש קטגוריה {{categoryLink}} עד","confirm_pin":"יש לך כבר {{count}} נושאים נעוצים. עודף נושאים נעוצים עשוי להכביד על משתמשים חדשים או אלמוניים. אכן לנעוץ נושא נוסף בקטגוריה זו? ","unpin":"הסרת נושא זה מראש הקטגוריה {{categoryLink}}.","unpin_until":"גרמו לנושא זה להופיע בראש הקטגוריה {{categoryLink}} או המתינו עד \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_note":"משתמשים יכולים לבטל עצמאית את נעיצת הנושא באופן פרטני.","pin_validation":"דרוש תאריך על מנת לנעוץ את הנושא.","not_pinned":"אין נושאים שננעצו בקטגוריה {{categoryLink}}.","already_pinned":{"one":"נושא שנעוץ כרגע בקטגוריה {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e","two":"נושאים שנעוצים כרגע בקטגוריה {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","many":"נושאים שנעוצים כרגע בקטגוריה {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","other":"נושאים שנעוצים כרגע בקטגוריה {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"גרמו לנושא זה להופיע בראש כל רשימות הנושאים עד","confirm_pin_globally":"יש לך כבר {{count}} נושאים נעוצים באופן גלובלי. עודף נושאים נעוצים עשוי להכביד על משתמשים חדשים או אלמוניים. אכן לנעוץ נושא גלובלי נוסף?","unpin_globally":"הסרת נושא זה מראש כל רשימות הנושאים.","unpin_globally_until":"הסירו נושא זה מראש כל רשימות הנושאים או המתינו עד \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"משתמשים יכולים לבטל עצמאית את נעיצת הנושא באופן פרטני.","not_pinned_globally":"אין נושאים נעוצים גלובאלית.","already_pinned_globally":{"one":"נושא שכרגע נעוץ גלובלית: \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e","two":"נושאים שכרגע נעוצים גלובלית: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","many":"נושאים שכרגע נעוצים גלובלית: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","other":"נושאים שכרגע נעוצים גלובלית: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"הפכו נושא זה לבאנר אשר מופיע בראש כל העמודים.","remove_banner":"הסרת הבאנר שמופיע בראש כל העמודים.","banner_note":"משתמשים יכולים לבטל את הבאנר על ידי סגירתו. רק פוסט אחד יכול לשמש כבאנר בזמן נתון.","no_banner_exists":"אין נושא באנר","banner_exists":"\u003cstrong class='badge badge-notification unread'\u003eיש\u003c/strong\u003e כרגע נושא באנר."},"inviting":"מזמין...","automatically_add_to_groups":"הזמנה זו כוללת גם גישה לקבוצות הבאות:","invite_private":{"title":"הזמינו להודעה","email_or_username":"כתובת דואר אלקטרוני או שם משתמש של המוזמן","email_or_username_placeholder":"כתובת דואר אלקטרוני או שם משתמש","action":"הזמנה","success":"הזמנו את המשתמש להשתתף בשיחה.","success_group":"הזמנו את הקבוצה הזו להשתתף בהודעה זו.","error":"סליחה, הייתה שגיאה בהזמנת משתמש זה.","group_name":"שם הקבוצה"},"controls":"מכווני נושא","invite_reply":{"title":"הזמנה","username_placeholder":"שם משתמש","action":"שלח הזמנה","help":"הזמינו אנשים אחרים לנושא זה דרך דואר אלקטרוני או התראות","to_forum":"אנו נשלח הודעה קצרה בדוא״ל שתאפשר לחברים שלך להצטרף באופן מיידי על ידי לחיצה על קישור וללא צורך בכניסה למערכת.","sso_enabled":"הכניסו את שם המשתמש של האדם שברצונכם להזמין לנושא זה.","to_topic_blank":"הכניסו את שם המשתמש או כתובת הדואר האלקטרוני של האדם שברצונכם להזמין לנושא זה.","to_topic_email":"מילאת כתובת דוא״ל. אנחנו נשלח לך הזמנה בדוא״ל שתאפשר לחבריך להשיב לנושא הזה מיידית.","to_topic_username":"הזנת שם משתמש/ת. נשלח התראה עם לינק הזמנה לנושא הזה. ","to_username":"הכנסתם את שם המשתמש של האדם שברצונכם להזמין. אנו נשלח התראה למשתמש זה עם קישור המזמין אותו לנושא זה.","email_placeholder":"name@example.com","success_email":"שלחנו הזמנה אל \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. נודיע לך כשהזמנה תיענה. כדאי לבדוק את לשונית ההזמנות בעמוד המשתמש שלך כדי לעקוב אחר ההזמנות ששלחת.","success_username":"הזמנו את המשתמש להשתתף בנושא.","error":"מצטערים, לא יכלנו להזמין משתמש/ת אלו. אולי הם כבר הוזמנו בעבר? (תדירות שליחת ההזמנות מוגבלת)","success_existing_email":" כבר קיים משתמש עם כתובת הדוא״ל \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e. נשלחה הזמנה למשתמש להשתתף בנושא."},"login_reply":"יש להיכנס כדי להשיב","filters":{"n_posts":{"one":"פוסט אחד","two":"{{count}} פוסטים","many":"{{count}} פוסטים","other":"{{count}} פוסטים"},"cancel":"הסרת הסינון"},"move_to":{"title":"העבר ל","action":"העבר ל","error":"אראה שגיאה בהעברת הפוסט."},"split_topic":{"title":"העבר לנושא חדש","action":"העבר לנושא חדש","topic_name":"כותרת נושא חדש","radio_label":"נושא חדש","error":"הייתה שגיאה בהעברת הפוסטים לנושא החדש.","instructions":{"one":"אתם עומדים ליצור נושא חדש ולמלא אותו עם הפוסטים שבחרתם.","two":"אתם עומדים ליצור נושא חדש ולמלא אותו עם \u003cb\u003e{{count}}\u003c/b\u003e הפוסטים שבחרתם.","many":"אתם עומדים ליצור נושא חדש ולמלא אותו עם \u003cb\u003e{{count}}\u003c/b\u003e הפוסטים שבחרתם.","other":"אתם עומדים ליצור נושא חדש ולמלא אותו עם \u003cb\u003e{{count}}\u003c/b\u003e הפוסטים שבחרתם."}},"merge_topic":{"title":"העבר לנושא קיים","action":"העבר לנושא קיים","error":"התרחשה שגיאה בהעברת הפוסטים לנושא הזה.","radio_label":"נושא קיים","instructions":{"one":"בבקשה בחרו נושא אליו הייתם רוצים להעביר את הפוסט.","two":"בבקשה בחרו את הנושא אליו תרצה להעביר את \u003cb\u003e{{count}}\u003c/b\u003e הפוסטים.","many":"בבקשה בחרו את הנושא אליו תרצה להעביר את \u003cb\u003e{{count}}\u003c/b\u003e הפוסטים.","other":"בבקשה בחרו את הנושא אליו תרצה להעביר את \u003cb\u003e{{count}}\u003c/b\u003e הפוסטים."}},"move_to_new_message":{"title":"העבר להודעה חדשה","action":"העבר להודעה חדשה","message_title":"כותרת הודעה חדשה","radio_label":"הודעה חדשה","participants":"משתתפים","instructions":{"one":"אתם עומדים ליצור נושא חדש ולמלא אותו עם הפוסט שבחרתם.","two":"אתם עומדים ליצור נושא חדש ולמלא אותו עם \u003cb\u003e{{count}}\u003c/b\u003e הפוסטים שבחרתם.","many":"אתם עומדים ליצור נושא חדש ולמלא אותו עם \u003cb\u003e{{count}}\u003c/b\u003e הפוסטים שבחרתם.","other":"אתם עומדים ליצור נושא חדש ולמלא אותו עם \u003cb\u003e{{count}}\u003c/b\u003e הפוסטים שבחרתם."}},"move_to_existing_message":{"title":"העבר להודעה קיימת","action":"העבר להודעה קיימת","radio_label":"הודעה קיימת","participants":"משתתפים","instructions":{"one":"בבקשה בחרו את ההודעה אליה תרצו להעביר את הפוסט.","two":"בבקשה בחרו את ההודעה אליה תרצו להעביר את \u003cb\u003e{{count}}\u003c/b\u003e הפוסטים.","many":"בבקשה בחרו את ההודעה אליה תרצו להעביר את \u003cb\u003e{{count}}\u003c/b\u003e הפוסטים.","other":"בבקשה בחרו את ההודעה אליה תרצו להעביר את \u003cb\u003e{{count}}\u003c/b\u003e הפוסטים."}},"merge_posts":{"title":"ניזוג פוסטים שנבחרו","action":"מיזוג פוסטים שנבחרו","error":"ארעה שגיאה במיזוג הפוסטים שנבחרו."},"publish_page":{"title":"פרסום עמוד","publish":"פרסום","description":"כאשר נושא מפורסם כעמוד, ניתן לשתף את הכתובת שלו והיא תוצג בסגנון עצמאי.","slug":"מזהה ייצוגי","publish_url":"העמוד שלך פורסם ב־:","topic_published":"הנושא שלך פורסם ב־:","preview_url":"העמוד שלך יפורסם ב־:","invalid_slug":"אין לך אפשרות לפרסם את העמוד הזה, עמך הסליחה.","unpublish":"משיכת הפרסום","unpublished":"פרסום העמוד שלך נמשך ואין זמין עוד.","publishing_settings":"הגדרות פרסום"},"change_owner":{"title":"שנה בעלים","action":"שנה בעלות","error":"התרחשה שגיאה בשינוי הבעלות של ההדעות.","placeholder":"שם המשתמש של הבעלים החדש","instructions":{"one":"אנא בחרו את הבעלים החדש של הפוסט מאת \u003cb\u003e{{old_user}}\u003c/b\u003e.","two":"אנא בחרו את הבעלים החדש של {{count}} הפוסטים מאת \u003cb\u003e@{{old_user}}\u003c/b\u003e.","many":"אנא בחרו את הבעלים החדש של {{count}} הפוסטים מאת \u003cb\u003e@{{old_user}}\u003c/b\u003e.","other":"אנא בחרו את הבעלים החדש של {{count}} הפוסטים מאת \u003cb\u003e@{{old_user}}\u003c/b\u003e."},"instructions_without_old_user":{"one":"נא לבחור בעלים חדש לפוסט","two":"נא לבחור בעלים חדש ל־{{count}} הפוסטים","many":"נא לבחור בעלים חדש ל־{{count}} הפוסטים","other":"נא לבחור בעלים חדש ל־{{count}} הפוסטים"}},"change_timestamp":{"title":"שינוי חותמת זמן...","action":"שינוי חותמת זמן","invalid_timestamp":"חותמת זמן לא יכולה להיות בעתיד.","error":"היתה שגיאה בשינוי חותמת הזמן של הנושא.","instructions":"אנא בחרו את חותמת הזמן החדשה של הנושא. פוסטים בנושא יועדכנו לאותם הפרשי זמנים."},"multi_select":{"select":"בחירה","selected":"נבחרו ({{count}})","select_post":{"label":"בחירה","title":"הוספת פוסט לבחירה"},"selected_post":{"label":"נבחרים","title":"הקליקו לביטול בחירת הפוסט"},"select_replies":{"label":"נבחרו +תגובות","title":"הוספת פוסט ואת כל התגובות שלו לבחירה"},"select_below":{"label":"יש לבחור +להלן","title":"הוספת פוסט וכל מה שאחריו לבחירה"},"delete":"מחק נבחרים","cancel":"בטל בחירה","select_all":"בחר הכל","deselect_all":"בחר כלום","description":{"one":"בחרתם פוסט אחד.","two":"בחרתם \u003cb\u003e{{count}}\u003c/b\u003e פוסטים.","many":"בחרתם \u003cb\u003e{{count}}\u003c/b\u003e פוסטים.","other":"בחרתם \u003cb\u003e{{count}}\u003c/b\u003e פוסטים."}},"deleted_by_author":{"one":"(הנושא הוסר עקב חרטת המפרסם, הוא ימחק אוטומטית בעוד שעה אלמלא יסומן בדגל)","two":"(הנושא הוסר עקב חרטת המפרסם, הוא ימחק אוטומטית בעוד שעתיים אלמלא יסומן בדגל)","many":"(הנושא הוסר עקב חרטת המפרסם, הוא ימחק אוטומטית בעוד %{count} שעות אלמלא יסומן בדגל)","other":"(הנושא הוסר עקב חרטת המפרסם, הוא ימחק אוטומטית בעוד %{count} שעות אלמלא יסומן בדגל)"}},"post":{"quote_reply":"ציטוט","edit_reason":"סיבה: ","post_number":"פוסט {{number}}","ignored":"תוכן בהתעלמות","wiki_last_edited_on":"וויקי נערך לאחרונה ב","last_edited_on":"הפוסט נערך לאחרונה ב","reply_as_new_topic":"תגובה כנושא מקושר","reply_as_new_private_message":"תגובה כהודעה חדשה לאותם נמענים","continue_discussion":"ממשיך את הדיון מ {{postLink}}:","follow_quote":"מעבר לפוסט המצוטט","show_full":"הצגת פוסט מלא","show_hidden":"צפייה בתוכן שמיועד להתעלמות.","deleted_by_author":{"one":"(הפוסט בוטל על ידי הכותבים, הוא ימחק אוטומטית בעוד %{count} שעות אלא אם יסומן בדגל)","two":"(הפוסט נלקח בחזרה על ידי הכותבים, הוא ימחק אוטומטית בעוד %{count} שעות אלא אם כן הוא ידוגל)","many":"(הפוסט נלקח בחזרה על ידי הכותבים, הוא ימחק אוטומטית בעוד %{count} שעות אלא אם כן הוא ידוגל)","other":"(הפוסט נלקח בחזרה על ידי הכותבים, הוא ימחק אוטומטית בעוד %{count} שעות אלא אם כן הוא ידוגל)"},"collapse":"צמצום","expand_collapse":"הרחב/צמצם","locked":"חבר סגל נעל את האפשרות לערוך את הפוסט הזה","gap":{"one":"הצג תגובה אחת שהוסתרה","two":"הצגת {{count}} תגובות שהוסתרו","many":"הצגת {{count}} תגובות שהוסתרו","other":"הצגת {{count}} תגובות שהוסתרו"},"notice":{"new_user":"זהו הפרסום הראשון מאת {{user}} - הבה נקבל את פניו/ה לקהילה שלנו!","returning_user":"עבר זמן מה מאז שראינו במחוזותינו את {{user}} - הפרסום האחרון שלו/ה היה ב־{{time}}."},"unread":"הפוסט טרם נקרא","has_replies":{"one":"תגובה אחת","two":"{{count}} תגובות","many":"{{count}} תגובות","other":"{{count}} תגובות"},"has_likes_title":{"one":"מישהו אחד אהב את התגובה הזו","two":"{{count}} אנשים אהבו את התגובה הזו","many":"{{count}} אנשים אהבו את התגובה הזו","other":"{{count}} אנשים אהבו את התגובה הזו"},"has_likes_title_only_you":"אהבת את התגובה הזו","has_likes_title_you":{"one":"אתם ועוד מישהו אהבתם את הפוסט הזה","two":"אתם ו {{count}} אנשים אחרים אהבתם את הפוסט הזה","many":"אתם ו {{count}} אנשים אחרים אהבתם את הפוסט הזה","other":"אתם ו {{count}} אנשים אחרים אהבתם את הפוסט הזה"},"errors":{"create":"אירעה שגיאה ביצירת הפוסט שלך. נא לנסות שוב, עמך הסליחה.","edit":"אירעה שגיאה בעריכת הפוסט שלך. נא לנסות שוב, עמך הסליחה.","upload":"סליחה, הייתה שגיאה בהעלאת הקובץ שלך. אנא נסו שנית","file_too_large":"הקובץ הזה גדול מדי (הגודל המרבי הוא {{max_size_kb}} ק״ב), עמך הסליחה. למה שלא להעלות את הקובץ שלך לשירות שיתוף בענן ואז להדביק את הקישור?","too_many_uploads":"סליחה, אך ניתן להעלות רק קובץ אחת כל פעם.","too_many_dragged_and_dropped_files":"אפשר להעלות עד {{max}} קבצים בכל פעם, עמך הסליחה.","upload_not_authorized":"הקובץ שמועמד להעלאה אינו מורשה (סיומות מורשות: {{authorized_extensions}}), עמך הסליחה.","image_upload_not_allowed_for_new_user":"סליחה, משתמשים חדשים לא יכולים להעלות תמונות.","attachment_upload_not_allowed_for_new_user":"סליחה, משתמשים חדשים לא יכולים להעלות קבצים.","attachment_download_requires_login":"מצטערים, עליכם להיות מחוברים כדי להוריד את הקבצים המצורפים."},"abandon_edit":{"confirm":"להתעלם מהשינויים שלך?","no_value":"לא, שמור","no_save_draft":"לא, לשמור טיוטה","yes_value":"כן, להתעלם מהעריכה"},"abandon":{"confirm":"לנטוש את הפוסט שלך?","no_value":"לא, שמור אותו","no_save_draft":"לא, לשמור טיוטה","yes_value":"כן, נטוש"},"via_email":"פוסט זה הגיע בדוא״ל","via_auto_generated_email":"פוסט זה הגיע דרך הודעת דוא״ל שנוצרה אוטומטית","whisper":"פוסט זה הוא לחישה פרטית למפקחים","wiki":{"about":"הפוסט הוא ויקי"},"archetypes":{"save":"שמור אפשרויות"},"few_likes_left":"תודה על כל האהבה! נותרו לך סימוני לייק מועטים להיום.","controls":{"reply":"התחילו לכתוב תגובה לפוסט זה","like":"תנו לייק לפוסט זה","has_liked":"אהבת פוסט זה","read_indicator":"חברים שקוראים את הפוסט הזה","undo_like":"בטל 'אהוב'","edit":"עירכו פוסט זה","edit_action":"עריכה","edit_anonymous":"מצטערים, אך עליכם להיות מחוברים בכדי לערוך פוסט זה.","flag":"דגלו פוסט זה באופן פרטי לתשומת לב או שלחו התראה פרטית עליו","delete":"מחק פוסט זה","undelete":"שחזר פוסט זה","share":"שיתוף קישור לפוסט זה","more":"עוד","delete_replies":{"confirm":"למחוק את התגובות לפוסט הזה?","direct_replies":{"one":"כן, ותגובה אחת ישירה","two":"כן, ושתי תגובות ישירות","many":"כן, ו־{{count}} תגובות ישירות","other":"כן, ו־{{count}} תגובות ישירות"},"all_replies":{"one":"כן, ותגובה אחת","two":"כן, ושתי תגובות.","many":"כן, וכל {{count}}התגובות.","other":"כן, וכל {{count}}התגובות."},"just_the_post":"לא, רק את הפוסט"},"admin":"פעולות ניהול של הפוסט","wiki":"יצירת wiki","unwiki":"הסרת ה-Wiki","convert_to_moderator":"הוספת צבע סגל","revert_to_regular":"הסרת צבע סגל","rebake":"בנייה מחודשת של HTML","publish_page":"פרסום עמוד","unhide":"הסרת הסתרה","change_owner":"שינוי בעלות","grant_badge":"הענקת עיטור","lock_post":"נעילת פוסט","lock_post_description":"למנוע מהמפרסם לערוך את הפוסט הזה","unlock_post":"שחרור פוסט","unlock_post_description":"לאפשר למפרסם לערוך את הפוסט הזה","delete_topic_disallowed_modal":"אין לך הרשאות למחוק את הנושא הזה. כדי למחוק אותו לצמיתות, יש לסמן אותו בדגל כדי שיקבל את תשומת לב הפיקוח לרבות סיבת הסימון.","delete_topic_disallowed":"אין לך הרשאה למחוק את הנושא הזה","delete_topic":"מחיקת נושא","add_post_notice":"הוספת התראת סגל","remove_post_notice":"הסרת התראת סגל","remove_timer":"הסרת שעון עצר"},"actions":{"flag":"דיגול","defer_flags":{"one":"התעלמות מדגל","two":"התעלמות מדגלים","many":"התעלמות מדגלים","other":"התעלמות מדגלים"},"undo":{"off_topic":"ביטול דיגול","spam":"ביטול דיגול","inappropriate":"ביטול דיגול","bookmark":"בטל העדפה","like":"בטל לייק"},"people":{"off_topic":"דוגל כאוף-טופיק","spam":"דוגל כספאם","inappropriate":"דוגל כלא ראוי","notify_moderators":"דיווח למפקחים","notify_user":"נשלחה הודעה","bookmark":"סומן","like":{"one":"אהב/ה את זה","two":"אהבו את זה","many":"אהבו את זה","other":"אהבו את זה"},"read":{"one":"קרא/ה את זה","two":"קראו את זה","many":"קראו את זה","other":"קראו את זה"},"like_capped":{"one":"ועוד מישהו אהב את זה","two":"ועוד 2 נוספים אהבו את זה","many":"ועוד {{count}} נוספים אהבו את זה","other":"ועוד {{count}} נוספים אהבו את זה"},"read_capped":{"one":"ועוד מישהו/י ({{count}}) קרא/ה את זה","two":"ו־{{count}} נוספים קראו את זה","many":"ו־{{count}} נוספים קראו את זה","other":"ו־{{count}} נוספים קראו את זה"}},"by_you":{"off_topic":"דיגלתם פרסום זה כאוף-טופיק","spam":"דיגלתם את זה כספאם","inappropriate":"דיגלתם את זה כלא ראוי","notify_moderators":"סימנת זאת בדגל לפיקוח","notify_user":"שלחתם הודעה למשתמש זה","bookmark":"סימנתם פוסט זה עם סימנייה","like":"נתת לזה לייק"}},"delete":{"confirm":{"one":"למחוק את הפוסט הזה?","two":"למחוק את {{count}} הפוסטים האלה?","many":"למחוק את {{count}} הפוסטים האלה?","other":"למחוק את {{count}} הפוסטים האלה?"}},"merge":{"confirm":{"one":"האם אתם בטוחים שאתם מעוניינים למזג פוסטים אלו?","two":"האם אתם בטוחים שאתם מעוניינים למזג {{count}} פוסטים אלו?","many":"האם אתם בטוחים שאתם מעוניינים למזג {{count}} פוסטים אלו?","other":"האם אתם בטוחים שאתם מעוניינים למזג {{count}} פוסטים אלו?"}},"revisions":{"controls":{"first":"מהדורה ראשונה","previous":"מהדורה קודמת","next":"מהדורה באה","last":"מהדורה אחרונה","hide":"הסתרת שינויים","show":"הצגת שינויים","revert":"חזרה לגרסה זו","edit_wiki":"עריכת וויקי","edit_post":"עריכת פוסט","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e {{icon}} \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"הצג את הפלט עם תוספות והסרות בתוכו","button":"HTML"},"side_by_side":{"title":"הצג את הפרשי הפלט אחד ליד השני","button":"HTML"},"side_by_side_markdown":{"title":"הציגו את ההבדלי המקור הגולמיים זה לצד זה","button":"גולמי"}}},"raw_email":{"displays":{"raw":{"title":"הצגת הודעת הדוא״ל הגולמית","button":"גולמי"},"text_part":{"title":"הצגת חלק הטקסט בהודעת הדוא״ל","button":"טקסט"},"html_part":{"title":"הצגת חלק ה־HTML בהודעת הדוא״ל","button":"HTML"}}},"bookmarks":{"create":"יצירת סימנייה","edit":"עריכת סימנייה","created":"נוצר","name":"שם","name_placeholder":"עבור מה הסימנייה?","set_reminder":"להזכיר לי","actions":{"delete_bookmark":{"name":"מחיקת סימנייה","description":"הסרת הסימנייה מהפרופיל שלך והפסקת התזכורות לסימנייה"},"edit_bookmark":{"name":"עריכת סימנייה","description":"עריכת שם הסימנייה או החלפת מועד התזכורת"}}}},"category":{"can":"יכול\u0026hellip; ","none":"(ללא קטגוריה)","all":"כל הקטגוריות","choose":"קטגוריה\u0026hellip;","edit":"עריכה","edit_dialog_title":"עריכה: %{categoryName}","view":"הצגת נושאים בקטגוריה","general":"כללי","settings":"הגדרות","topic_template":"תבנית נושא","tags":"תגיות","tags_allowed_tags":"הגבלת התגיות האלו לקטגוריה הזו:","tags_allowed_tag_groups":"הגבלת קבוצות תגיות אלו לקטגוריה זו:","tags_placeholder":"(רשות) רשימת תגיות מותרות","tags_tab_description":"תגיות וקבוצות תגיות שצוינו להלן תהיינה זמינות בקטגוריה זו ובקטגוריות נוספות שמציינות אותן. הן לא תהיינה זמינות בקטגוריות אחרות.","tag_groups_placeholder":"(רשות) רשימת קבוצות תגיות","manage_tag_groups_link":"ניהול קבוצות תגיות מכאן.","allow_global_tags_label":"לאפשר גם תגיות אחרות","tag_group_selector_placeholder":"(רשות) קבוצת תגיות","required_tag_group_description":"לדרוש שלנושאים חדשים יהיו תגיות מקבוצת תגיות:","min_tags_from_required_group_label":"מס׳ תגיות:","required_tag_group_label":"קבוצת תגיות:","topic_featured_link_allowed":"אפשרו קישורים מומלצים בקטגוריה זו","delete":"מחיקת קטגוריה","create":"קטגוריה חדשה","create_long":"יצירת קטגוריה חדשה","save":"שמירת קטגוריה","slug":"כתובת חלזונית לקטגוריה","slug_placeholder":"(רשות) מילים-מחוברות-במקפים-ככתובת","creation_error":"ארעה שגיאה במהלך יצירת הקטגוריה הזו.","save_error":"ארעה שגיאה בשמירת הקטגוריה הזו","name":"שם הקטגוריה","description":"תיאור","topic":"נושא הקטגוריה","logo":"תמונת לוגו לקטגוריה","background_image":"תמונת רקע לקטגוריה","badge_colors":"צבעי העיטורים","background_color":"צבע רקע","foreground_color":"צבע קדמי","name_placeholder":"מילה או שתיים לכל היותר","color_placeholder":"כל צבע אינטרנטי","delete_confirm":"האם שברצונך להסיר את הקטגוריה הזו?","delete_error":"ארעה שגיאה במחיקת הקטגוריה.","list":"הצג קטגוריות","no_description":"אנא הוסיפו תיאור לקטגוריה זו.","change_in_category_topic":"עריכת תיאור","already_used":"הצבע הזה בשימוש על ידי קטגוריה אחרת","security":"אבטחה","special_warning":"אזהרה: קטגוריה זו הגיעה מראש והגדרות האבטחה שלה אינן ניתנות לשינוי. אם אתם מעוניינים להשתמש בקטגוריה זו, מחקו אותה במקום להשתמש בה מחדש.","uncategorized_security_warning":"קטגוריה זו היא מיוחדת. היא מיועדת להחזקת מגוון של נושאים שאין להם קטגוריה, לא יכולות להיות לקבוצה זו הגדרות אבטחה.","uncategorized_general_warning":"קטגוריה זו היא מיוחדת. היא משמשת כקטגוריית בררת המחדל לנושאים חדשים שלא נבחרה עבורם קטגוריה. אם ברצונך למנוע את ההתנהגות הזאת ולאלץ בחירת קטגוריה, \u003ca href=\"%{settingLink}\"\u003eנא לנטרל את ההגדרה הזאת כאן\u003c/a\u003e. אם מעניין אותך לשנות את השם או את התיאור, עליך לגשת אל \u003ca href=\"%{customizeLink}\"\u003eהתאמה אישית / תוכן טקסט\u003c/a\u003e.","pending_permission_change_alert":"לא הוספת %{group} לקטגוריה הזאת, יש ללחוץ על הכפתור הזה כדי להוסיף אותן.","images":"תמונות","email_in":"כתובת דואר נכנס מותאמת אישית:","email_in_allow_strangers":"קבלת דוא״ל ממשתמשים אלמוניים ללא חשבונות במערכת הפורומים","email_in_disabled":"האפשרות לשליחת נושאים חדשים בדוא״ל הושבתה בהגדרות האתר. כדי להפעיל פרסום של נושאים חדשים דרך דוא״ל,","email_in_disabled_click":"לאפשר את את ההגדרה „דוא״ל נכנס”","mailinglist_mirror":"קטגוריה שמשקפת רשימת תפוצה","show_subcategory_list":"הצגת רשימת קטגוריות משנה מעל נושאים בקטגוריה זו.","num_featured_topics":"מספר הנושאים המוצגים בדף הקטגוריות:","subcategory_num_featured_topics":"מספר הנושאים המומלצים בדף קטגוריית ההורה:","all_topics_wiki":"להפוך נושאים חדשים לעמודי ויקי כבררת מחדל","subcategory_list_style":"סגנון רשימות קטגוריות משנה:","sort_order":"סידור ברירת מחדל לנושאים:","default_view":"תצוגת ברירת מחדל לנושאים:","default_top_period":"פרק זמן דיפולטיבי להובלה","allow_badges_label":"לאפשר הענקת עיטורים בקטגוריה זו","edit_permissions":"עריכת הרשאות","reviewable_by_group":"בנוסף לסגל, פוסטים ודגלים בקטגוריה הזאת יכולים להיות נתונים גם לסקירתם של:","review_group_name":"שם הקבוצה","require_topic_approval":"לדרוש אישור מפקח לכל הנושאים החדשים","require_reply_approval":"לדרוש אישור מפקח לכל התגובות החדשות","this_year":"השנה","position":"מיקום בעמוד הקטגוריות:","default_position":"מיקום ברירת מחדל","position_disabled":"קטגוריות יוצגו על פס סדר הפעילות. כדי לשלוט בסדר הקטגורייות ברשימה,","position_disabled_click":"אפשרו את ההגדרה \"סדר קטגוריות קבוע\".","minimum_required_tags":"מספר התגיות המזערי הנדרש לנושא:","parent":"קטגורית אם","num_auto_bump_daily":"מספר הנושאים הפתוחים להקפצה מדי יום:","navigate_to_first_post_after_read":"ניווט לפוסט הראשוני לאחר שהנושאים נקראו","notifications":{"watching":{"title":"עוקב","description":"תצפו באופן אוטומטי בכל הנושאים שבקטגוריות אלו. תקבלו התראה על כל פוסט חדש בכל אחד מהנושאים בקטגוריה ואת מספר התגובות לכל אחד מהם."},"watching_first_post":{"title":"צפייה בפוסט הראשון","description":"תופענה אצלך התראות על נושאים חדשים בקטגוריה הזו אך לא על תגובות על הנושאים."},"tracking":{"title":"עוקב","description":"אתם תעקבו אוטומטית אחרי כל הנושאים בקטגוריות אלו. אתם תיודעו אם מישהו מזכיר את @שמכם או עונה לכם, וספירה של תגובות חדשות תופיע לכם."},"regular":{"title":"נורמלי","description":"תישלח אליך התראה אם מישהו יזכיר את @שם_המשתמש שלך או ישיב לך."},"muted":{"title":"מושתק","description":"לא תקבלו התראות על נושאים חדשים בקטגוריות אלו, והם לא יופיעו בעמוד הלא-נקראו שלך."}},"search_priority":{"label":"עדיפות חיפוש","options":{"normal":"רגיל","ignore":"התעלמות","very_low":"נמוכה מאוד","low":"נמוכה","high":"גבוהה","very_high":"גבוהה מאוד"}},"sort_options":{"default":"ברירת מחדל","likes":"לייקים","op_likes":"לייקים של הפוסט המקורי","views":"מבטים","posts":"פוסטים","activity":"פעילות","posters":"מפרסמים","category":"קטגוריה","created":"נוצרו","votes":"הצבעות"},"sort_ascending":"בסדר עולה","sort_descending":"בסדר יורד","subcategory_list_styles":{"rows":"שורות","rows_with_featured_topics":"שורות עם נושאים מומלצים","boxes":"קופסאות","boxes_with_featured_topics":"קופסאות אם נושאים מומלצים"},"settings_sections":{"general":"כללי","moderation":"פיקוח","appearance":"מראה","email":"דואר אלקטרוני"}},"flagging":{"title":"תודה על עזרתך לשמירה על תרבות הקהילה שלנו!","action":"דגלו פוסט","take_action":"ניקטו פעולה","notify_action":"הודעה","official_warning":"אזהרה רשמית","delete_spammer":"מחק ספאמר","yes_delete_spammer":"כן, מחק ספאמר","ip_address_missing":"(N/A)","hidden_email_address":"(מוסתר)","submit_tooltip":"שלחו את הדגל הפרטי","take_action_tooltip":"הגעה באופן מיידי למספר הדגלים האפשרי, במקום להמתין לדגלים נוספים מן הקהילה","cant":"סליחה, לא ניתן לדגל פוסט זה כרגע.","notify_staff":"להודיע לסגל באופן פרטי","formatted_name":{"off_topic":"אוף-טופיק","inappropriate":"לא ראוי","spam":"זהו ספאם"},"custom_placeholder_notify_user":"היו ממוקדים, חיובים ותמיד אדיבים.","custom_placeholder_notify_moderators":"נשמח לשמוע בדיוק מה מטריד אותך ולספק קישורים מתאימים ודוגמאות היכן שניתן.","custom_message":{"at_least":{"one":"הכניסו לפחות תו אחד","two":"הכניסו לפחות {{count}} תווים","many":"הכניסו לפחות {{count}} תווים","other":"הכניסו לפחות {{count}} תווים"},"more":{"one":"נשאר אחד","two":"{{count}} נשארו...","many":"{{count}} נשארו...","other":"{{count}} נשארו..."},"left":{"one":"נותר אחד","two":"{{count}} נותרו","many":"{{count}} נותרו","other":"{{count}} נותרו"}}},"flagging_topic":{"title":"תודה על עזרתך לשמירה על תרבות הקהילה שלנו!","action":"דגלו נושא","notify_action":"הודעה"},"topic_map":{"title":"סיכום נושא","participants_title":"מפרסמים מתמידים","links_title":"לינקים פופלארים","links_shown":"הצגת קישורים נוספים...","clicks":{"one":"לחיצה אחת","two":"%{count} לחיצות","many":"%{count} לחיצות","other":"%{count} לחיצות"}},"post_links":{"about":"הרחיבו לינקים נוספים לפוסט זה","title":{"one":"עוד %{count}","two":"עוד %{count}","many":"עוד %{count}","other":"עוד %{count}"}},"topic_statuses":{"warning":{"help":"זוהי אזהרה רשמית."},"bookmarked":{"help":"יצרתם סימניה לנושא זה"},"locked":{"help":"הנושא הזה סגור, הוא לא מקבל יותר תגובות חדשות"},"archived":{"help":"הנושא הזה אוכסן בארכיון; הוא הוקפא ולא ניתן לשנותו"},"locked_and_archived":{"help":"הנושא הזה סגור ומאורכב. לא ניתן להגיב בו יותר או לשנות אותו. "},"unpinned":{"title":"הורד מנעיצה","help":"נושא זה אינו מקובע עבורכם; הוא יופיע בסדר הרגיל"},"pinned_globally":{"title":"נעוץ גלובאלית","help":"הנושא הזה נעוץ בכל האתר; הוא יוצג בראש הקטגוריה שלו כחדש ביותר"},"pinned":{"title":"נעוץ","help":"נושא זה ננעץ עבורכם, הוא יופיע בראש הקטגוריה"},"unlisted":{"help":"נושא זה מוסתר; הוא לא יוצג ברשימות הנושאים, וזמין רק באמצעות קישור ישיר."},"personal_message":{"title":"הנושא הזה הוא הודעה אישית","help":"הנושא הזה הוא הודעה אישית"}},"posts":"פוסטים","posts_long":"יש {{number}} פוסטים בנושא הזה","original_post":"פוסט מקורי","views":"צפיות","views_lowercase":{"one":"צפיה","two":"צפיות","many":"צפיות","other":"צפיות"},"replies":"תגובות","views_long":{"one":"נושא זה נצפה פעם %{count}","two":"נושא זה נצפה {{number}} פעמים","many":"נושא זה נצפה {{number}} פעמים","other":"נושא זה נצפה {{number}} פעמים"},"activity":"פעילות","likes":"לייקים","likes_lowercase":{"one":"לייק","two":"לייקים","many":"לייקים","other":"לייקים"},"likes_long":"יש {{number}} לייקים לנושא הזה","users":"משתמשים","users_lowercase":{"one":"משתמש","two":"משתמשים","many":"משתמשים","other":"משתמשים"},"category_title":"קטגוריה","history":"היסטוריה","changed_by":"מאת {{author}}","raw_email":{"title":"דוא״ל נכנס","not_available":"לא זמין!"},"categories_list":"רשימת קטגוריות","filters":{"with_topics":"%{filter} נושאים","with_category":"%{filter} %{category} נושאים","latest":{"title":"פורסמו לאחרונה","title_with_count":{"one":"האחרון (%{count})","two":"({{count}}) פורסמו לאחרונה","many":"({{count}}) פורסמו לאחרונה","other":"({{count}}) פורסמו לאחרונה"},"help":"נושאים עם תגובות לאחרונה"},"read":{"title":"נקרא","help":"נושאים שקראת, לפי סדר קריאתם"},"categories":{"title":"קטגוריות","title_in":"קטגוריה - {{categoryName}}","help":"כל הנושאים תחת הקטגוריה הזו"},"unread":{"title":"לא-נקראו","title_with_count":{"one":"לא נקראה (%{count})","two":"לא-נקראו ({{count}})","many":"לא-נקראו ({{count}})","other":"לא נקראו ({{count}})"},"help":"נושאים שאתם כרגע צופים או עוקבים אחריהם עם פוסטים שלא נקראו","lower_title_with_count":{"one":"לא נקרא (%{count})","two":"לא-נקראו {{count}} ","many":"לא-נקראו {{count}} ","other":"לא-נקראו {{count}} "}},"new":{"lower_title_with_count":{"one":"חדש (%{count})","two":"{{count}} חדשים","many":"{{count}} חדשים","other":"{{count}} חדשים"},"lower_title":"חדש","title":"חדש","title_with_count":{"one":"חדש (%{count})","two":"חדשים ({{count}})","many":"חדשים ({{count}})","other":"חדשים ({{count}})"},"help":"נושאים שנוצרו בימים האחרונים"},"posted":{"title":"הפוסטים שלי","help":"נושאים בהם פרסמת"},"bookmarks":{"title":"סימניות","help":"נושאים עבורם יצרתם סימניות"},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} (%{count})","two":"{{categoryName}} ({{count}})","many":"{{categoryName}} ({{count}})","other":"{{categoryName}} ({{count}})"},"help":"נושאים מדוברים בקטגוריה {{categoryName}}"},"top":{"title":"מובילים","help":"הנושאים הפעילים ביותר בשנה, חודש, שבוע או יום האחרונים","all":{"title":"תמיד"},"yearly":{"title":"שנתי"},"quarterly":{"title":"רבעוני"},"monthly":{"title":"חודשי"},"weekly":{"title":"שבועי"},"daily":{"title":"יומי"},"all_time":"כל הזמנים","this_year":"שנה","this_quarter":"רבעוני","this_month":"חודש","this_week":"שבוע","today":"היום","other_periods":"ראה חלק עליון"},"votes":{"title":"הצבעות","help":"נושאים עם הכי הרבה הצבעות"}},"browser_update":"אתרע מזלך וכי \u003ca href=\"https://www.discourse.org/faq/#browser\"\u003eדפדפנך מיושן מכדי להפעיל אתר זה\u003c/a\u003e. נא \u003ca href=\"https://browsehappy.com\"\u003eלשדרג את דפדפנך\u003c/a\u003e.","permission_types":{"full":"יצירה / תגובה / צפייה","create_post":"תגובה / צפייה","readonly":"צפה"},"lightbox":{"download":"הורדה","previous":"הקודם (מקש שמאלה)","next":"הבא (מקש ימינה)","counter":"%curr% מתוך %total%","close":"סגירה (Esc)","content_load_error":"אין אפשרות לטעון את ה\u003ca href=\"%url%\"\u003eתוכן הזה\u003c/a\u003e.","image_load_error":"אין אפשרות לטעון את ה\u003ca href=\"%url%\"\u003eתמונה הזו\u003c/a\u003e."},"keyboard_shortcuts_help":{"shortcut_key_delimiter_comma":", ","shortcut_key_delimiter_plus":"+","shortcut_delimiter_or":"%{shortcut1} או %{shortcut2}","shortcut_delimiter_slash":"%{shortcut1}/%{shortcut2}","shortcut_delimiter_space":"%{shortcut1} %{shortcut2}","title":"קיצורי מקלדת","jump_to":{"title":"קפצו אל","home":"%{shortcut} בית","latest":"%{shortcut} אחרונים","new":"%{shortcut} חדשים","unread":"%{shortcut} לא-נקראו","categories":"%{shortcut} קטגוריות","top":"%{shortcut} מובילים","bookmarks":"%{shortcut} סימניות","profile":"%{shortcut} פרופיל","messages":"%{shortcut} הודעות","drafts":"%{shortcut} טיוטות"},"navigation":{"title":"ניווט","jump":"%{shortcut} מעבר לפוסט #","back":"%{shortcut} חזרה","up_down":"%{shortcut} הזיזו בחירה \u0026uarr; \u0026darr;","open":"%{shortcut} פתחו נושא נבחר","next_prev":"%{shortcut} תחום הבא/קודם","go_to_unread_post":"%{shortcut} מעבר לפוסט הראשון שלא נקרא"},"application":{"title":"אפליקציה","create":"%{shortcut} יצירת נושא חדש","notifications":"%{shortcut} פתיחת התראות","hamburger_menu":"%{shortcut} פתיחת תפריט המבורגר","user_profile_menu":"%{shortcut} פתיחת תפריט משתמש","show_incoming_updated_topics":"%{shortcut} הצגת נושאים שהתעדכנו","search":"%{shortcut} חיפוש","help":"%{shortcut} פתיחת קיצורי מקשים","dismiss_new_posts":"%{shortcut} בטלו חדשים/פוסטים","dismiss_topics":"%{shortcut} בטלו נושאים","log_out":"%{shortcut} התנתקות"},"composing":{"title":"חיבור","return":"%{shortcut} חזרה לכתיבת פוסט","fullscreen":"%{shortcut} כתיבת פוסט במסך מלא"},"bookmarks":{"title":"ניהול סימניות","enter":"%{shortcut} שמירה וסגירה","later_today":"%{shortcut} בהמשך היום","later_this_week":"%{shortcut} בהמשך השבוע","tomorrow":"%{shortcut} מחר","next_week":"%{shortcut} שבוע הבא","next_month":"%{shortcut} חודש הבא","next_business_week":"%{shortcut} תחילת שבוע הבא","next_business_day":"%{shortcut} יום העסקים הבא","custom":"%{shortcut} בחירת שעה ותאריך","none":"%{shortcut} ללא תזכורת","delete":"%{shortcut} מחיקת סימנייה"},"actions":{"title":"פעולות","bookmark_topic":"%{shortcut} סמנו/בטלו-סימנייה של נושא","pin_unpin_topic":"%{shortcut} נעצו/בטלו נעיצה בנושא","share_topic":"%{shortcut} שיתוף נושא","share_post":"%{shortcut} שיתוף פוסט","reply_as_new_topic":"%{shortcut} מענה כנושא קשור","reply_topic":"%{shortcut} ענו לנושא","reply_post":"%{shortcut} תגובה לפוסט","quote_post":"%{shortcut} ציטוט פוסט","like":"%{shortcut} אהבו פוסט","flag":"%{shortcut} דגלו פוסט","bookmark":"%{shortcut} סימון פוסט","edit":"%{shortcut} עריכת פוסט","delete":"%{shortcut} מחיקת פוסט","mark_muted":"%{shortcut} השתקת נושא","mark_regular":"%{shortcut} נושא רגיל","mark_tracking":"%{shortcut} עקבו אחר נושא","mark_watching":"%{shortcut} צפו בנושא","print":"%{shortcut} הדפסת נושא","defer":"%{shortcut} לדחות נושא לאחר כך","topic_admin_actions":"%{shortcut} פתיחת פעולות ניהול לנושא"},"search_menu":{"title":"תפריט חיפוש","prev_next":"%{shortcut} העברת הבחירה למעלה ולמטה","insert_url":"%{shortcut} הוספת הבחירה לחלון כתיבת ההודעה הפתוח"}},"badges":{"earned_n_times":{"one":"עיטור זה הוענק פעם אחת (%{count})","two":"עיטור זה הוענק %{count} פעמים","many":"עיטור זה הוענק %{count} פעמים","other":"עיטור זה הוענק %{count} פעמים"},"granted_on":"הוענק לפני %{date}","others_count":"אחרים עם עיטור זה (%{count})","title":"עיטורים","allow_title":"ניתן להשתמש בעיטור זה ככותרת","multiple_grant":"ניתן לזכות בו מספר פעמים","badge_count":{"one":"%{count} עיטורים","two":"%{count} עיטורים","many":"%{count} עיטורים","other":"%{count} עיטורים"},"more_badges":{"one":"+%{count} נוסף","two":"+%{count} נוספים","many":"+%{count} נוספים","other":"+%{count} נוספים"},"granted":{"one":"הוענק","two":"%{count} הוענקו","many":"%{count} הוענקו","other":"%{count} הוענקו"},"select_badge_for_title":"נא לבחור עיטור לשימוש בכותרת שלך","none":"(ללא)","successfully_granted":"העיטור %{badge} הוענק בהצלחה למשתמש %{username}","badge_grouping":{"getting_started":{"name":"מתחילים"},"community":{"name":"קהילה"},"trust_level":{"name":"דרגת אמון"},"other":{"name":"אחר"},"posting":{"name":"מפרסמים"}}},"tagging":{"all_tags":"כל התגיות","other_tags":"תגיות אחרות","selector_all_tags":"כל התגיות","selector_no_tags":"ללא תגיות","changed":"תגיות ששונו:","tags":"תגיות","choose_for_topic":"תגיות רשות","info":"פרטים","default_info":"תגית זו אינה מוגבלת לקטגוריות כלשהן ואין לה מילים נרדפות.","category_restricted":"תגית זו מוגבלת לקטגוריות שאין לך גישה אליהן.","synonyms":"מילים נרדפות","synonyms_description":"תגיות אלו תוחלפנה בתגית \u003cb\u003e%{base_tag_name}\u003c/b\u003e.","tag_groups_info":{"one":"תגית זו שייכת לקבוצה הזאת: {{tag_groups}}","two":"תגית זו שייכת לקבוצות האלו: {{tag_groups}}","many":"תגית זו שייכת לקבוצות האלו: {{tag_groups}}","other":"תגית זו שייכת לקבוצות האלו: {{tag_groups}}"},"category_restrictions":{"one":"ניתן להשתמש בה בקטגוריה זו בלבד:","two":"ניתן להשתמש בה בקטגוריות אלו בלבד:","many":"ניתן להשתמש בה בקטגוריות אלו בלבד:","other":"ניתן להשתמש בה בקטגוריות אלו בלבד:"},"edit_synonyms":"ניהול מילים נרדפות","add_synonyms_label":"הוספת מילים נרדפות:","add_synonyms":"הוספה","add_synonyms_explanation":{"one":"כל מקום שמשתמש כרגע בתגית זו יעבור להשתמש ב־\u003cb\u003e%{tag_name}\u003c/b\u003e במקום. להמשיך בשינוי הזה?","two":"כל מקום שמשתמש כרגע בתגיות אלו יעבור להשתמש ב־\u003cb\u003e%{tag_name}\u003c/b\u003e במקום. להמשיך בשינוי הזה?","many":"כל מקום שמשתמש כרגע בתגיות אלו יעבור להשתמש ב־\u003cb\u003e%{tag_name}\u003c/b\u003e במקום. להמשיך בשינוי הזה?","other":"כל מקום שמשתמש כרגע בתגיות אלו יעבור להשתמש ב־\u003cb\u003e%{tag_name}\u003c/b\u003e במקום. להמשיך בשינוי הזה?"},"add_synonyms_failed":"לא ניתן להוסיף את התגיות הבאות בתור מילים נרדפות: \u003cb\u003e%{tag_names}\u003c/b\u003e. נא לוודא שאין להן מילים נרדפות ושאינן כבר מילים נרדפות של תגית אחרת.","remove_synonym":"הסרת מילה נרדפת","delete_synonym_confirm":"למחוק את המילה הנרדפת „%{tag_name}”?","delete_tag":"מחיקת תגית","delete_confirm":{"one":"למחוק את התגית הזו ולהסיר אותה מהנושא אליו היא מוקצית?","two":"למחוק את התגית הזו ולהסיר אותה משני הנושאים אליהן היא מוקצית?","many":"למחוק את התגית הזו ולהסיר אותה מכל {{count}} הנושאים אליהן היא מוקצית?","other":"למחוק את התגית הזו ולהסיר אותה מכל {{count}} הנושאים אליהן היא מוקצית?"},"delete_confirm_no_topics":"למחוק את התגית הזו?","delete_confirm_synonyms":{"one":"המילה הנרדפת שקשורה אליה תימחקנה גם כן.","two":"{{count}} המילים הנרדפות שקשורות אליה תימחקנה גם כן.","many":"{{count}} המילים הנרדפות שקשורות אליה תימחקנה גם כן.","other":"{{count}} המילים הנרדפות שקשורות אליה תימחקנה גם כן."},"rename_tag":"שינוי שם לתגית","rename_instructions":"בחרו שם חדש לתגית:","sort_by":"סידור לפי:","sort_by_count":"ספירה","sort_by_name":"שם","manage_groups":"ניהול קבוצות תגים","manage_groups_description":"הגדרת קבוצות לארגון תגיות","upload":"העלאת תגיות","upload_description":"ניתן להעלות קובץ csv כדי ליצור כמות גדולה של תגיות בבת אחת","upload_instructions":"אחת בשורה, אפשר עם קבוצת תגיות בתצורה ‚שם_תגית,קבוצת_תגיות’.","upload_successful":"התגיות הועלו בהצלחה","delete_unused_confirmation":{"one":"תגית אחת תימחק: %{tags}","two":"%{count} תגיות תימחקנה: %{tags}","many":"%{count} תגיות תימחקנה: %{tags}","other":"%{count} תגיות תימחקנה: %{tags}"},"delete_unused_confirmation_more_tags":{"one":"%{tags} ואחת נוספת ","two":"%{tags} ו־%{count} נוספות","many":"%{tags} ו־%{count} נוספות","other":"%{tags} ו־%{count} נוספות"},"delete_unused":"מחיקת תגיות שאינן בשימוש","delete_unused_description":"למחוק את כל התגיות שאינן מקושרות לנושאים או להודעות פרטיות כלל","cancel_delete_unused":"ביטול","filters":{"without_category":"%{filter} %{tag} נושאים","with_category":"%{filter} %{tag} נושאים ב%{category}","untagged_without_category":"%{filter} נושאים לא מתוייגים","untagged_with_category":"%{filter} נושאים ללא תגיות ב %{category}"},"notifications":{"watching":{"title":"צופים","description":"כל הנושאים עם התגית הזו אוטומטית יתווספו למעקב שלך. אצלך תופענה התרעות של כל הפוסטים והנושאים החדשים, לרבות תוכן של פוסטים חדשים וכאלו שלא נקראו גם כן יופיעו ליד הנושא."},"watching_first_post":{"title":"צפייה בפוסט הראשון","description":"תופענה אצלך התראות על נושאים חדשים בתגית זו אך לא על תגובות לנושאים."},"tracking":{"title":"במעקב","description":"יתווספו למעקב שלך אוטומטית כל הנושאים עם התגית הזאת. הספירה של הפריטים שלא נקראו ושל הפוסטים החדשים תופיע ליד הנושא."},"regular":{"title":"רגיל","description":"תישלח אליך התראה אם @שמך מוזכר או שמתקבלת תגובה לפוסט שלך."},"muted":{"title":"בהשתקה","description":"לא תופענה אצלך אף התראות בנוגע לנושאים חדשים עם התגית הזאת והן לא תופענה בלשונית הפריטים שלא נקראו."}},"groups":{"title":"תיוג קבוצות","about":"ניתן להוסיף תגיות לקבוצות כדי לנהל אותן ביתר קלות.","new":"קבוצה חדשה","tags_label":"תגיות בקבוצה זו:","tags_placeholder":"תגיות","parent_tag_label":"תג הורה:","parent_tag_placeholder":"רשות","parent_tag_description":"תגיות מקבוצה זו לא ניתנות לשימוש אלא אם תגית ההורה קיימת.","one_per_topic_label":"הגבלה של תג אחד לכל נושא מקבוצה זו","new_name":"קבוצת תגיות חדשה","name_placeholder":"שם קבוצת תגיות","save":"שמירה","delete":"מחיקה","confirm_delete":"להסיר את קבוצת התגיות הזו?","everyone_can_use":"ניתן להשתמש בתגיות בכל מקום","usable_only_by_staff":"התגיות גלויות לכולם אך רק חברי סגל יכולים להשתמש בהן","visible_only_to_staff":"התגיות גלויות בפני הסגל בלבד"},"topics":{"none":{"unread":"אין לך נושאים שלא נקראו.","new":"אין לך נושאים חדשים.","read":"טרם קראת נושאים.","posted":"עדיין לא פרסמתם באף נושא.","latest":"אין נושאים אחרונים.","bookmarks":"עדיין אין לך נושאים מסומנים.","top":"אין נושאים מובילים."},"bottom":{"latest":"אין יותר נושאים אחרונים.","posted":"אין יותר נושאים שפורסמו.","read":"אין יותר נושאים שניקראו.","new":"אין יותר נושאים חדשים.","unread":"אין יותר נושאים שלא-נקראו.","top":"אין יותר נושאים מובילים.","bookmarks":"אין יותר נושאים שסומנו."}}},"invite":{"custom_message":"ניתן להעניק להזמנה שלך מגע אישי יותר על ידי כתיבת \u003ca href\u003eהודעה אישית\u003c/a\u003e.","custom_message_placeholder":"הכניסו את הודעתכם האישית","custom_message_template_forum":"היי, זה פורום מומלץ, כדאי להצטרף אליו!","custom_message_template_topic":"היי, חשבתי שהנושא הזה יעניין אותך!"},"forced_anonymous":"עקב עומס חריג, הודעה זו מוצגת באופן זמני לכולם כפי שתופיע בפני משתמשים שלא נכנסו למערכת.","safe_mode":{"enabled":"מצב בטוח מאופשר, כדי לצאת ממנו סיגרו את חלון הדפדפן הזה"},"poll":{"voters":{"one":"מצביע","two":"מצביעים","many":"מצביעים","other":"מצביעים"},"total_votes":{"one":"מספר הצבעות כולל","two":"מספר הצבעות כולל","many":"מספר הצבעות כולל","other":"מספר הצבעות"},"average_rating":"דירוג ממוצע: \u003cstrong\u003e%{average}\u003c/strong\u003e.","public":{"title":"ההצבעות הן \u003cstrong\u003eציבוריות\u003c/strong\u003e."},"results":{"groups":{"title":"עליך להיות חבר בקבוצה %{groups} כדי להצביע לסקר הזה."},"vote":{"title":"התוצאות יופיעו לאחר \u003cstrong\u003eההצבעה\u003c/strong\u003e."},"closed":{"title":"התוצאות יופיעו לאחר \u003cstrong\u003eהסגירה\u003c/strong\u003e."},"staff":{"title":"התוצאות זמינות לחברי \u003cstrong\u003eסגל\u003c/strong\u003e בלבד."}},"multiple":{"help":{"at_least_min_options":{"one":"נא לבחור באפשרות \u003cstrong\u003eאחת\u003c/strong\u003e לפחות","two":"נא לבחור ב־\u003cstrong\u003e%{count}\u003c/strong\u003e אפשרויות לפחות","many":"נא לבחור ב־\u003cstrong\u003e%{count}\u003c/strong\u003e אפשרויות לפחות","other":"נא לבחור ב־\u003cstrong\u003e%{count}\u003c/strong\u003e אפשרויות לפחות"},"up_to_max_options":{"one":"נא לבחור עד אפשרות \u003cstrong\u003eאחת\u003c/strong\u003e.","two":"נא לבחור עד \u003cstrong\u003e%{count}\u003c/strong\u003e אפשרויות","many":"נא לבחור עד \u003cstrong\u003e%{count}\u003c/strong\u003e אפשרויות","other":"נא לבחור עד \u003cstrong\u003e%{count}\u003c/strong\u003e אפשרויות"},"x_options":{"one":"נא לבחור באפשרות אחת","two":"נא לבחור \u003cstrong\u003e%{count}\u003c/strong\u003e אפשרויות","many":"נא לבחור \u003cstrong\u003e%{count}\u003c/strong\u003e אפשרויות","other":"נא לבחור \u003cstrong\u003e%{count}\u003c/strong\u003e אפשרויות"},"between_min_and_max_options":"נא לבחור בין \u003cstrong\u003e%{min}\u003c/strong\u003e ל־\u003cstrong\u003e%{max}\u003c/strong\u003e אפשרויות"}},"cast-votes":{"title":"להצביע","label":"להצביע עכשיו!"},"show-results":{"title":"הצגת תוצאות הסקר","label":"הצגת תוצאות"},"hide-results":{"title":"חזרה להצבעות שלך","label":"הצגת הצבעה"},"group-results":{"title":"קיבוץ הצבעות לפי משתמש","label":"הצגת פילוח"},"ungroup-results":{"title":"שקלול כל ההצבעות","label":"הסתרת הפילוח"},"export-results":{"title":"ייצוא תוצאות הסקר","label":"ייצוא"},"open":{"title":"פתיחת הסקר","label":"פתיחה","confirm":"לפתוח את הסקר הזה?"},"close":{"title":"סגירת הסקר","label":"סגירה","confirm":"לסגור סקר זה?"},"automatic_close":{"closes_in":"נסגר בעוד \u003cstrong\u003e%{timeLeft}\u003c/strong\u003e.","age":"נסגר ב־\u003cstrong\u003e%{age}\u003c/strong\u003e"},"error_while_toggling_status":" חלה שגיאה בשינוי המצב של סקר זה, עמך הסליחה.","error_while_casting_votes":"חלה שגיאה בהצבעתך, עמך הסליחה.","error_while_fetching_voters":"חלה שגיאה בהצגת המצביעים, עמך הסליחה.","error_while_exporting_results":"אירעה שגיאה בייצוא תוצאות הסקר.","ui_builder":{"title":"בניית סקר","insert":"הכנסת סקר","help":{"options_count":"יש למלא אפשרות אחת לפחות","invalid_values":"הערך המזערי חייב להיות קטן מהערך המרבי.","min_step_value":"ערך הצעד המזערי הוא 1"},"poll_type":{"label":"סוג","regular":"בחירה בודדת","multiple":"בחירה מרובה","number":"ציון מספרי"},"poll_result":{"label":"תוצאות","always":"גלוי תמיד","vote":"בהליכי הצבעה","closed":"כאשר סגור","staff":"סגל בלבד"},"poll_groups":{"label":"קבוצות מורשות"},"poll_chart_type":{"label":"סוג תרשים"},"poll_config":{"max":"מרבי","min":"מזערי","step":"צעד"},"poll_public":{"label":"להציג מי המצביעים"},"poll_options":{"label":"נא למלא אפשרות בחירה אחת בכל שורה"},"automatic_close":{"label":"לסגור את הסקר אוטומטית"}}},"discourse_narrative_bot":{"welcome_post_type":{"new_user_track":"התחילו את המדריך למתחילים לכל המשתמשים החדשים","welcome_message":"שילחו לכל המשתמשים החדשים הודעה עם מדריך להתחלה מהירה"}},"discourse_local_dates":{"relative_dates":{"today":"היום ב־%{time}","tomorrow":"מחר ב־%{time}","yesterday":"אתמול ב־%{time}","countdown":{"passed":"התאריך חלף"}},"title":"הוספת תאריך / שעה","create":{"form":{"insert":"כתיבה","advanced_mode":"מצב מורחב","simple_mode":"מצב פשוט","format_description":"תבנית להצגת תאריך המשתמש. יש להשתמש ב־„‎\\T\\Z” כדי להציג את אזור הזמן של המשתמש במילים (אסיה/ירושלים)","timezones_title":"אזורי זמן","timezones_description":"באזורי זמן נעשה שימוש לטובת הצגת תאריך בתצוגה מקדימה וכבררת מחדל.","recurring_title":"חזרה","recurring_description":"הגדרת תדירות חזרת האירוע. ניתן גם לערוך ידנית את אפשרות החזרה שנוצרה על ידי הטופס ולהשתמש במפתחות הבאים: years,‏ quarters,‏ months,‏ weeks,‏ days,‏ hours,‏ minutes,‏ seconds,‏ milliseconds.","recurring_none":"ללא חזרה","invalid_date":"תאריך שגוי, נא לוודא שהתאריך והשעה נכונים","date_title":"תאריך","time_title":"זמן","format_title":"מבנה תאריך","timezone":"אזור זמן","until":"עד…","recurring":{"every_day":"כל יום","every_week":"כל שבוע","every_two_weeks":"כל שבועיים","every_month":"כל חודש","every_two_months":"כל חודשיים","every_three_months":"כל שלושה חודשים","every_six_months":"כל חצי שנה","every_year":"כל שנה"}}}},"details":{"title":"הסתרת פרטים"},"presence":{"replying":"תגובה","editing":"עריכה","replying_to_topic":{"one":"תגובה","two":"תגובה","many":"תגובה","other":"תגובה"}},"voting":{"title":"הצבעה","reached_limit":"נגמרו לך ההצבעות, עליך להסיר הצבעה קיימת!","list_votes":"הצגת ההצבעות שלך","votes_nav_help":"נושאים עם הכי הרבה הצבעות","voted":"הצבעת לנושא זה","allow_topic_voting":"לאפשר למשתמשים להצביע על נושאים בקטגוריה זו","vote_title":"הצבעה","vote_title_plural":"הצבעות","voted_title":"התקבלה הצבעה","voting_closed_title":"נסגר","voting_limit":"מגבלה","votes_left":{"one":"נותרה לרשותך הצבעה אחת, ניתן להביט ב\u003ca href='{{path}}'\u003eהצבעות שלך\u003c/a\u003e.","two":"נותרו לרשותך {{count}} הצבעות, ניתן להביט ב\u003ca href='{{path}}'\u003eהצבעות שלך\u003c/a\u003e.","many":"נותרו לרשותך {{count}} הצבעות, ניתן להביט ב\u003ca href='{{path}}'\u003eהצבעות שלך\u003c/a\u003e.","other":"נותרו לרשותך {{count}} הצבעות, ניתן להביט ב\u003ca href='{{path}}'\u003eהצבעות שלך\u003c/a\u003e."},"votes":{"one":"הצבעה אחת","two":"{{count}} הצבעות","many":"{{count}} הצבעות","other":"{{count}} הצבעות"},"anonymous_button":{"one":"הצבעה","two":"הצבעות","many":"הצבעות","other":"הצבעות"},"remove_vote":"הסרת הצבעה"},"adplugin":{"advertisement_label":"פרסום"},"docker":{"upgrade":"התקנת ה-Discourse שלכם אינה מעודכנת.","perform_upgrade":"לחצו כאן כדי לשדרג."}}},"zh_CN":{},"en":{"js":{"local_time":"Local Time","discourse_internet_explorer":{"deprecation_warning":"This site will soon remove support for Internet Explorer 11 - please update your browser"},"poll":{"ui_builder":{"poll_chart_type":{"bar":"Bar","pie":"Pie"}}},"admin":{"logs":{"staff_actions":{"actions":{"discourse_upgrade":"Upgrade to the Latest Version"}}}},"docker":{"link_to_upgrade":"Perform upgrades here."}}}};
I18n.locale = 'he';
I18n.pluralizationRules.he = MessageFormat.locale.he;
//! moment.js

;(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    global.moment = factory()
}(this, (function () { 'use strict';

    var hookCallback;

    function hooks () {
        return hookCallback.apply(null, arguments);
    }

    // This is done to register the method called with moment()
    // without creating circular dependencies.
    function setHookCallback (callback) {
        hookCallback = callback;
    }

    function isArray(input) {
        return input instanceof Array || Object.prototype.toString.call(input) === '[object Array]';
    }

    function isObject(input) {
        // IE8 will treat undefined and null as object if it wasn't for
        // input != null
        return input != null && Object.prototype.toString.call(input) === '[object Object]';
    }

    function isObjectEmpty(obj) {
        if (Object.getOwnPropertyNames) {
            return (Object.getOwnPropertyNames(obj).length === 0);
        } else {
            var k;
            for (k in obj) {
                if (obj.hasOwnProperty(k)) {
                    return false;
                }
            }
            return true;
        }
    }

    function isUndefined(input) {
        return input === void 0;
    }

    function isNumber(input) {
        return typeof input === 'number' || Object.prototype.toString.call(input) === '[object Number]';
    }

    function isDate(input) {
        return input instanceof Date || Object.prototype.toString.call(input) === '[object Date]';
    }

    function map(arr, fn) {
        var res = [], i;
        for (i = 0; i < arr.length; ++i) {
            res.push(fn(arr[i], i));
        }
        return res;
    }

    function hasOwnProp(a, b) {
        return Object.prototype.hasOwnProperty.call(a, b);
    }

    function extend(a, b) {
        for (var i in b) {
            if (hasOwnProp(b, i)) {
                a[i] = b[i];
            }
        }

        if (hasOwnProp(b, 'toString')) {
            a.toString = b.toString;
        }

        if (hasOwnProp(b, 'valueOf')) {
            a.valueOf = b.valueOf;
        }

        return a;
    }

    function createUTC (input, format, locale, strict) {
        return createLocalOrUTC(input, format, locale, strict, true).utc();
    }

    function defaultParsingFlags() {
        // We need to deep clone this object.
        return {
            empty           : false,
            unusedTokens    : [],
            unusedInput     : [],
            overflow        : -2,
            charsLeftOver   : 0,
            nullInput       : false,
            invalidMonth    : null,
            invalidFormat   : false,
            userInvalidated : false,
            iso             : false,
            parsedDateParts : [],
            meridiem        : null,
            rfc2822         : false,
            weekdayMismatch : false
        };
    }

    function getParsingFlags(m) {
        if (m._pf == null) {
            m._pf = defaultParsingFlags();
        }
        return m._pf;
    }

    var some;
    if (Array.prototype.some) {
        some = Array.prototype.some;
    } else {
        some = function (fun) {
            var t = Object(this);
            var len = t.length >>> 0;

            for (var i = 0; i < len; i++) {
                if (i in t && fun.call(this, t[i], i, t)) {
                    return true;
                }
            }

            return false;
        };
    }

    function isValid(m) {
        if (m._isValid == null) {
            var flags = getParsingFlags(m);
            var parsedParts = some.call(flags.parsedDateParts, function (i) {
                return i != null;
            });
            var isNowValid = !isNaN(m._d.getTime()) &&
                flags.overflow < 0 &&
                !flags.empty &&
                !flags.invalidMonth &&
                !flags.invalidWeekday &&
                !flags.weekdayMismatch &&
                !flags.nullInput &&
                !flags.invalidFormat &&
                !flags.userInvalidated &&
                (!flags.meridiem || (flags.meridiem && parsedParts));

            if (m._strict) {
                isNowValid = isNowValid &&
                    flags.charsLeftOver === 0 &&
                    flags.unusedTokens.length === 0 &&
                    flags.bigHour === undefined;
            }

            if (Object.isFrozen == null || !Object.isFrozen(m)) {
                m._isValid = isNowValid;
            }
            else {
                return isNowValid;
            }
        }
        return m._isValid;
    }

    function createInvalid (flags) {
        var m = createUTC(NaN);
        if (flags != null) {
            extend(getParsingFlags(m), flags);
        }
        else {
            getParsingFlags(m).userInvalidated = true;
        }

        return m;
    }

    // Plugins that add properties should also add the key here (null value),
    // so we can properly clone ourselves.
    var momentProperties = hooks.momentProperties = [];

    function copyConfig(to, from) {
        var i, prop, val;

        if (!isUndefined(from._isAMomentObject)) {
            to._isAMomentObject = from._isAMomentObject;
        }
        if (!isUndefined(from._i)) {
            to._i = from._i;
        }
        if (!isUndefined(from._f)) {
            to._f = from._f;
        }
        if (!isUndefined(from._l)) {
            to._l = from._l;
        }
        if (!isUndefined(from._strict)) {
            to._strict = from._strict;
        }
        if (!isUndefined(from._tzm)) {
            to._tzm = from._tzm;
        }
        if (!isUndefined(from._isUTC)) {
            to._isUTC = from._isUTC;
        }
        if (!isUndefined(from._offset)) {
            to._offset = from._offset;
        }
        if (!isUndefined(from._pf)) {
            to._pf = getParsingFlags(from);
        }
        if (!isUndefined(from._locale)) {
            to._locale = from._locale;
        }

        if (momentProperties.length > 0) {
            for (i = 0; i < momentProperties.length; i++) {
                prop = momentProperties[i];
                val = from[prop];
                if (!isUndefined(val)) {
                    to[prop] = val;
                }
            }
        }

        return to;
    }

    var updateInProgress = false;

    // Moment prototype object
    function Moment(config) {
        copyConfig(this, config);
        this._d = new Date(config._d != null ? config._d.getTime() : NaN);
        if (!this.isValid()) {
            this._d = new Date(NaN);
        }
        // Prevent infinite loop in case updateOffset creates new moment
        // objects.
        if (updateInProgress === false) {
            updateInProgress = true;
            hooks.updateOffset(this);
            updateInProgress = false;
        }
    }

    function isMoment (obj) {
        return obj instanceof Moment || (obj != null && obj._isAMomentObject != null);
    }

    function absFloor (number) {
        if (number < 0) {
            // -0 -> 0
            return Math.ceil(number) || 0;
        } else {
            return Math.floor(number);
        }
    }

    function toInt(argumentForCoercion) {
        var coercedNumber = +argumentForCoercion,
            value = 0;

        if (coercedNumber !== 0 && isFinite(coercedNumber)) {
            value = absFloor(coercedNumber);
        }

        return value;
    }

    // compare two arrays, return the number of differences
    function compareArrays(array1, array2, dontConvert) {
        var len = Math.min(array1.length, array2.length),
            lengthDiff = Math.abs(array1.length - array2.length),
            diffs = 0,
            i;
        for (i = 0; i < len; i++) {
            if ((dontConvert && array1[i] !== array2[i]) ||
                (!dontConvert && toInt(array1[i]) !== toInt(array2[i]))) {
                diffs++;
            }
        }
        return diffs + lengthDiff;
    }

    function warn(msg) {
        if (hooks.suppressDeprecationWarnings === false &&
                (typeof console !==  'undefined') && console.warn) {
            console.warn('Deprecation warning: ' + msg);
        }
    }

    function deprecate(msg, fn) {
        var firstTime = true;

        return extend(function () {
            if (hooks.deprecationHandler != null) {
                hooks.deprecationHandler(null, msg);
            }
            if (firstTime) {
                var args = [];
                var arg;
                for (var i = 0; i < arguments.length; i++) {
                    arg = '';
                    if (typeof arguments[i] === 'object') {
                        arg += '\n[' + i + '] ';
                        for (var key in arguments[0]) {
                            arg += key + ': ' + arguments[0][key] + ', ';
                        }
                        arg = arg.slice(0, -2); // Remove trailing comma and space
                    } else {
                        arg = arguments[i];
                    }
                    args.push(arg);
                }
                warn(msg + '\nArguments: ' + Array.prototype.slice.call(args).join('') + '\n' + (new Error()).stack);
                firstTime = false;
            }
            return fn.apply(this, arguments);
        }, fn);
    }

    var deprecations = {};

    function deprecateSimple(name, msg) {
        if (hooks.deprecationHandler != null) {
            hooks.deprecationHandler(name, msg);
        }
        if (!deprecations[name]) {
            warn(msg);
            deprecations[name] = true;
        }
    }

    hooks.suppressDeprecationWarnings = false;
    hooks.deprecationHandler = null;

    function isFunction(input) {
        return input instanceof Function || Object.prototype.toString.call(input) === '[object Function]';
    }

    function set (config) {
        var prop, i;
        for (i in config) {
            prop = config[i];
            if (isFunction(prop)) {
                this[i] = prop;
            } else {
                this['_' + i] = prop;
            }
        }
        this._config = config;
        // Lenient ordinal parsing accepts just a number in addition to
        // number + (possibly) stuff coming from _dayOfMonthOrdinalParse.
        // TODO: Remove "ordinalParse" fallback in next major release.
        this._dayOfMonthOrdinalParseLenient = new RegExp(
            (this._dayOfMonthOrdinalParse.source || this._ordinalParse.source) +
                '|' + (/\d{1,2}/).source);
    }

    function mergeConfigs(parentConfig, childConfig) {
        var res = extend({}, parentConfig), prop;
        for (prop in childConfig) {
            if (hasOwnProp(childConfig, prop)) {
                if (isObject(parentConfig[prop]) && isObject(childConfig[prop])) {
                    res[prop] = {};
                    extend(res[prop], parentConfig[prop]);
                    extend(res[prop], childConfig[prop]);
                } else if (childConfig[prop] != null) {
                    res[prop] = childConfig[prop];
                } else {
                    delete res[prop];
                }
            }
        }
        for (prop in parentConfig) {
            if (hasOwnProp(parentConfig, prop) &&
                    !hasOwnProp(childConfig, prop) &&
                    isObject(parentConfig[prop])) {
                // make sure changes to properties don't modify parent config
                res[prop] = extend({}, res[prop]);
            }
        }
        return res;
    }

    function Locale(config) {
        if (config != null) {
            this.set(config);
        }
    }

    var keys;

    if (Object.keys) {
        keys = Object.keys;
    } else {
        keys = function (obj) {
            var i, res = [];
            for (i in obj) {
                if (hasOwnProp(obj, i)) {
                    res.push(i);
                }
            }
            return res;
        };
    }

    var defaultCalendar = {
        sameDay : '[Today at] LT',
        nextDay : '[Tomorrow at] LT',
        nextWeek : 'dddd [at] LT',
        lastDay : '[Yesterday at] LT',
        lastWeek : '[Last] dddd [at] LT',
        sameElse : 'L'
    };

    function calendar (key, mom, now) {
        var output = this._calendar[key] || this._calendar['sameElse'];
        return isFunction(output) ? output.call(mom, now) : output;
    }

    var defaultLongDateFormat = {
        LTS  : 'h:mm:ss A',
        LT   : 'h:mm A',
        L    : 'MM/DD/YYYY',
        LL   : 'MMMM D, YYYY',
        LLL  : 'MMMM D, YYYY h:mm A',
        LLLL : 'dddd, MMMM D, YYYY h:mm A'
    };

    function longDateFormat (key) {
        var format = this._longDateFormat[key],
            formatUpper = this._longDateFormat[key.toUpperCase()];

        if (format || !formatUpper) {
            return format;
        }

        this._longDateFormat[key] = formatUpper.replace(/MMMM|MM|DD|dddd/g, function (val) {
            return val.slice(1);
        });

        return this._longDateFormat[key];
    }

    var defaultInvalidDate = 'Invalid date';

    function invalidDate () {
        return this._invalidDate;
    }

    var defaultOrdinal = '%d';
    var defaultDayOfMonthOrdinalParse = /\d{1,2}/;

    function ordinal (number) {
        return this._ordinal.replace('%d', number);
    }

    var defaultRelativeTime = {
        future : 'in %s',
        past   : '%s ago',
        s  : 'a few seconds',
        ss : '%d seconds',
        m  : 'a minute',
        mm : '%d minutes',
        h  : 'an hour',
        hh : '%d hours',
        d  : 'a day',
        dd : '%d days',
        M  : 'a month',
        MM : '%d months',
        y  : 'a year',
        yy : '%d years'
    };

    function relativeTime (number, withoutSuffix, string, isFuture) {
        var output = this._relativeTime[string];
        return (isFunction(output)) ?
            output(number, withoutSuffix, string, isFuture) :
            output.replace(/%d/i, number);
    }

    function pastFuture (diff, output) {
        var format = this._relativeTime[diff > 0 ? 'future' : 'past'];
        return isFunction(format) ? format(output) : format.replace(/%s/i, output);
    }

    var aliases = {};

    function addUnitAlias (unit, shorthand) {
        var lowerCase = unit.toLowerCase();
        aliases[lowerCase] = aliases[lowerCase + 's'] = aliases[shorthand] = unit;
    }

    function normalizeUnits(units) {
        return typeof units === 'string' ? aliases[units] || aliases[units.toLowerCase()] : undefined;
    }

    function normalizeObjectUnits(inputObject) {
        var normalizedInput = {},
            normalizedProp,
            prop;

        for (prop in inputObject) {
            if (hasOwnProp(inputObject, prop)) {
                normalizedProp = normalizeUnits(prop);
                if (normalizedProp) {
                    normalizedInput[normalizedProp] = inputObject[prop];
                }
            }
        }

        return normalizedInput;
    }

    var priorities = {};

    function addUnitPriority(unit, priority) {
        priorities[unit] = priority;
    }

    function getPrioritizedUnits(unitsObj) {
        var units = [];
        for (var u in unitsObj) {
            units.push({unit: u, priority: priorities[u]});
        }
        units.sort(function (a, b) {
            return a.priority - b.priority;
        });
        return units;
    }

    function zeroFill(number, targetLength, forceSign) {
        var absNumber = '' + Math.abs(number),
            zerosToFill = targetLength - absNumber.length,
            sign = number >= 0;
        return (sign ? (forceSign ? '+' : '') : '-') +
            Math.pow(10, Math.max(0, zerosToFill)).toString().substr(1) + absNumber;
    }

    var formattingTokens = /(\[[^\[]*\])|(\\)?([Hh]mm(ss)?|Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|Qo?|YYYYYY|YYYYY|YYYY|YY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|kk?|mm?|ss?|S{1,9}|x|X|zz?|ZZ?|.)/g;

    var localFormattingTokens = /(\[[^\[]*\])|(\\)?(LTS|LT|LL?L?L?|l{1,4})/g;

    var formatFunctions = {};

    var formatTokenFunctions = {};

    // token:    'M'
    // padded:   ['MM', 2]
    // ordinal:  'Mo'
    // callback: function () { this.month() + 1 }
    function addFormatToken (token, padded, ordinal, callback) {
        var func = callback;
        if (typeof callback === 'string') {
            func = function () {
                return this[callback]();
            };
        }
        if (token) {
            formatTokenFunctions[token] = func;
        }
        if (padded) {
            formatTokenFunctions[padded[0]] = function () {
                return zeroFill(func.apply(this, arguments), padded[1], padded[2]);
            };
        }
        if (ordinal) {
            formatTokenFunctions[ordinal] = function () {
                return this.localeData().ordinal(func.apply(this, arguments), token);
            };
        }
    }

    function removeFormattingTokens(input) {
        if (input.match(/\[[\s\S]/)) {
            return input.replace(/^\[|\]$/g, '');
        }
        return input.replace(/\\/g, '');
    }

    function makeFormatFunction(format) {
        var array = format.match(formattingTokens), i, length;

        for (i = 0, length = array.length; i < length; i++) {
            if (formatTokenFunctions[array[i]]) {
                array[i] = formatTokenFunctions[array[i]];
            } else {
                array[i] = removeFormattingTokens(array[i]);
            }
        }

        return function (mom) {
            var output = '', i;
            for (i = 0; i < length; i++) {
                output += isFunction(array[i]) ? array[i].call(mom, format) : array[i];
            }
            return output;
        };
    }

    // format date using native date object
    function formatMoment(m, format) {
        if (!m.isValid()) {
            return m.localeData().invalidDate();
        }

        format = expandFormat(format, m.localeData());
        formatFunctions[format] = formatFunctions[format] || makeFormatFunction(format);

        return formatFunctions[format](m);
    }

    function expandFormat(format, locale) {
        var i = 5;

        function replaceLongDateFormatTokens(input) {
            return locale.longDateFormat(input) || input;
        }

        localFormattingTokens.lastIndex = 0;
        while (i >= 0 && localFormattingTokens.test(format)) {
            format = format.replace(localFormattingTokens, replaceLongDateFormatTokens);
            localFormattingTokens.lastIndex = 0;
            i -= 1;
        }

        return format;
    }

    var match1         = /\d/;            //       0 - 9
    var match2         = /\d\d/;          //      00 - 99
    var match3         = /\d{3}/;         //     000 - 999
    var match4         = /\d{4}/;         //    0000 - 9999
    var match6         = /[+-]?\d{6}/;    // -999999 - 999999
    var match1to2      = /\d\d?/;         //       0 - 99
    var match3to4      = /\d\d\d\d?/;     //     999 - 9999
    var match5to6      = /\d\d\d\d\d\d?/; //   99999 - 999999
    var match1to3      = /\d{1,3}/;       //       0 - 999
    var match1to4      = /\d{1,4}/;       //       0 - 9999
    var match1to6      = /[+-]?\d{1,6}/;  // -999999 - 999999

    var matchUnsigned  = /\d+/;           //       0 - inf
    var matchSigned    = /[+-]?\d+/;      //    -inf - inf

    var matchOffset    = /Z|[+-]\d\d:?\d\d/gi; // +00:00 -00:00 +0000 -0000 or Z
    var matchShortOffset = /Z|[+-]\d\d(?::?\d\d)?/gi; // +00 -00 +00:00 -00:00 +0000 -0000 or Z

    var matchTimestamp = /[+-]?\d+(\.\d{1,3})?/; // 123456789 123456789.123

    // any word (or two) characters or numbers including two/three word month in arabic.
    // includes scottish gaelic two word and hyphenated months
    var matchWord = /[0-9]{0,256}['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFF07\uFF10-\uFFEF]{1,256}|[\u0600-\u06FF\/]{1,256}(\s*?[\u0600-\u06FF]{1,256}){1,2}/i;

    var regexes = {};

    function addRegexToken (token, regex, strictRegex) {
        regexes[token] = isFunction(regex) ? regex : function (isStrict, localeData) {
            return (isStrict && strictRegex) ? strictRegex : regex;
        };
    }

    function getParseRegexForToken (token, config) {
        if (!hasOwnProp(regexes, token)) {
            return new RegExp(unescapeFormat(token));
        }

        return regexes[token](config._strict, config._locale);
    }

    // Code from http://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
    function unescapeFormat(s) {
        return regexEscape(s.replace('\\', '').replace(/\\(\[)|\\(\])|\[([^\]\[]*)\]|\\(.)/g, function (matched, p1, p2, p3, p4) {
            return p1 || p2 || p3 || p4;
        }));
    }

    function regexEscape(s) {
        return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    var tokens = {};

    function addParseToken (token, callback) {
        var i, func = callback;
        if (typeof token === 'string') {
            token = [token];
        }
        if (isNumber(callback)) {
            func = function (input, array) {
                array[callback] = toInt(input);
            };
        }
        for (i = 0; i < token.length; i++) {
            tokens[token[i]] = func;
        }
    }

    function addWeekParseToken (token, callback) {
        addParseToken(token, function (input, array, config, token) {
            config._w = config._w || {};
            callback(input, config._w, config, token);
        });
    }

    function addTimeToArrayFromToken(token, input, config) {
        if (input != null && hasOwnProp(tokens, token)) {
            tokens[token](input, config._a, config, token);
        }
    }

    var YEAR = 0;
    var MONTH = 1;
    var DATE = 2;
    var HOUR = 3;
    var MINUTE = 4;
    var SECOND = 5;
    var MILLISECOND = 6;
    var WEEK = 7;
    var WEEKDAY = 8;

    // FORMATTING

    addFormatToken('Y', 0, 0, function () {
        var y = this.year();
        return y <= 9999 ? '' + y : '+' + y;
    });

    addFormatToken(0, ['YY', 2], 0, function () {
        return this.year() % 100;
    });

    addFormatToken(0, ['YYYY',   4],       0, 'year');
    addFormatToken(0, ['YYYYY',  5],       0, 'year');
    addFormatToken(0, ['YYYYYY', 6, true], 0, 'year');

    // ALIASES

    addUnitAlias('year', 'y');

    // PRIORITIES

    addUnitPriority('year', 1);

    // PARSING

    addRegexToken('Y',      matchSigned);
    addRegexToken('YY',     match1to2, match2);
    addRegexToken('YYYY',   match1to4, match4);
    addRegexToken('YYYYY',  match1to6, match6);
    addRegexToken('YYYYYY', match1to6, match6);

    addParseToken(['YYYYY', 'YYYYYY'], YEAR);
    addParseToken('YYYY', function (input, array) {
        array[YEAR] = input.length === 2 ? hooks.parseTwoDigitYear(input) : toInt(input);
    });
    addParseToken('YY', function (input, array) {
        array[YEAR] = hooks.parseTwoDigitYear(input);
    });
    addParseToken('Y', function (input, array) {
        array[YEAR] = parseInt(input, 10);
    });

    // HELPERS

    function daysInYear(year) {
        return isLeapYear(year) ? 366 : 365;
    }

    function isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    }

    // HOOKS

    hooks.parseTwoDigitYear = function (input) {
        return toInt(input) + (toInt(input) > 68 ? 1900 : 2000);
    };

    // MOMENTS

    var getSetYear = makeGetSet('FullYear', true);

    function getIsLeapYear () {
        return isLeapYear(this.year());
    }

    function makeGetSet (unit, keepTime) {
        return function (value) {
            if (value != null) {
                set$1(this, unit, value);
                hooks.updateOffset(this, keepTime);
                return this;
            } else {
                return get(this, unit);
            }
        };
    }

    function get (mom, unit) {
        return mom.isValid() ?
            mom._d['get' + (mom._isUTC ? 'UTC' : '') + unit]() : NaN;
    }

    function set$1 (mom, unit, value) {
        if (mom.isValid() && !isNaN(value)) {
            if (unit === 'FullYear' && isLeapYear(mom.year()) && mom.month() === 1 && mom.date() === 29) {
                mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value, mom.month(), daysInMonth(value, mom.month()));
            }
            else {
                mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value);
            }
        }
    }

    // MOMENTS

    function stringGet (units) {
        units = normalizeUnits(units);
        if (isFunction(this[units])) {
            return this[units]();
        }
        return this;
    }


    function stringSet (units, value) {
        if (typeof units === 'object') {
            units = normalizeObjectUnits(units);
            var prioritized = getPrioritizedUnits(units);
            for (var i = 0; i < prioritized.length; i++) {
                this[prioritized[i].unit](units[prioritized[i].unit]);
            }
        } else {
            units = normalizeUnits(units);
            if (isFunction(this[units])) {
                return this[units](value);
            }
        }
        return this;
    }

    function mod(n, x) {
        return ((n % x) + x) % x;
    }

    var indexOf;

    if (Array.prototype.indexOf) {
        indexOf = Array.prototype.indexOf;
    } else {
        indexOf = function (o) {
            // I know
            var i;
            for (i = 0; i < this.length; ++i) {
                if (this[i] === o) {
                    return i;
                }
            }
            return -1;
        };
    }

    function daysInMonth(year, month) {
        if (isNaN(year) || isNaN(month)) {
            return NaN;
        }
        var modMonth = mod(month, 12);
        year += (month - modMonth) / 12;
        return modMonth === 1 ? (isLeapYear(year) ? 29 : 28) : (31 - modMonth % 7 % 2);
    }

    // FORMATTING

    addFormatToken('M', ['MM', 2], 'Mo', function () {
        return this.month() + 1;
    });

    addFormatToken('MMM', 0, 0, function (format) {
        return this.localeData().monthsShort(this, format);
    });

    addFormatToken('MMMM', 0, 0, function (format) {
        return this.localeData().months(this, format);
    });

    // ALIASES

    addUnitAlias('month', 'M');

    // PRIORITY

    addUnitPriority('month', 8);

    // PARSING

    addRegexToken('M',    match1to2);
    addRegexToken('MM',   match1to2, match2);
    addRegexToken('MMM',  function (isStrict, locale) {
        return locale.monthsShortRegex(isStrict);
    });
    addRegexToken('MMMM', function (isStrict, locale) {
        return locale.monthsRegex(isStrict);
    });

    addParseToken(['M', 'MM'], function (input, array) {
        array[MONTH] = toInt(input) - 1;
    });

    addParseToken(['MMM', 'MMMM'], function (input, array, config, token) {
        var month = config._locale.monthsParse(input, token, config._strict);
        // if we didn't find a month name, mark the date as invalid.
        if (month != null) {
            array[MONTH] = month;
        } else {
            getParsingFlags(config).invalidMonth = input;
        }
    });

    // LOCALES

    var MONTHS_IN_FORMAT = /D[oD]?(\[[^\[\]]*\]|\s)+MMMM?/;
    var defaultLocaleMonths = 'January_February_March_April_May_June_July_August_September_October_November_December'.split('_');
    function localeMonths (m, format) {
        if (!m) {
            return isArray(this._months) ? this._months :
                this._months['standalone'];
        }
        return isArray(this._months) ? this._months[m.month()] :
            this._months[(this._months.isFormat || MONTHS_IN_FORMAT).test(format) ? 'format' : 'standalone'][m.month()];
    }

    var defaultLocaleMonthsShort = 'Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec'.split('_');
    function localeMonthsShort (m, format) {
        if (!m) {
            return isArray(this._monthsShort) ? this._monthsShort :
                this._monthsShort['standalone'];
        }
        return isArray(this._monthsShort) ? this._monthsShort[m.month()] :
            this._monthsShort[MONTHS_IN_FORMAT.test(format) ? 'format' : 'standalone'][m.month()];
    }

    function handleStrictParse(monthName, format, strict) {
        var i, ii, mom, llc = monthName.toLocaleLowerCase();
        if (!this._monthsParse) {
            // this is not used
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
            for (i = 0; i < 12; ++i) {
                mom = createUTC([2000, i]);
                this._shortMonthsParse[i] = this.monthsShort(mom, '').toLocaleLowerCase();
                this._longMonthsParse[i] = this.months(mom, '').toLocaleLowerCase();
            }
        }

        if (strict) {
            if (format === 'MMM') {
                ii = indexOf.call(this._shortMonthsParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._longMonthsParse, llc);
                return ii !== -1 ? ii : null;
            }
        } else {
            if (format === 'MMM') {
                ii = indexOf.call(this._shortMonthsParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._longMonthsParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._longMonthsParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortMonthsParse, llc);
                return ii !== -1 ? ii : null;
            }
        }
    }

    function localeMonthsParse (monthName, format, strict) {
        var i, mom, regex;

        if (this._monthsParseExact) {
            return handleStrictParse.call(this, monthName, format, strict);
        }

        if (!this._monthsParse) {
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
        }

        // TODO: add sorting
        // Sorting makes sure if one month (or abbr) is a prefix of another
        // see sorting in computeMonthsParse
        for (i = 0; i < 12; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, i]);
            if (strict && !this._longMonthsParse[i]) {
                this._longMonthsParse[i] = new RegExp('^' + this.months(mom, '').replace('.', '') + '$', 'i');
                this._shortMonthsParse[i] = new RegExp('^' + this.monthsShort(mom, '').replace('.', '') + '$', 'i');
            }
            if (!strict && !this._monthsParse[i]) {
                regex = '^' + this.months(mom, '') + '|^' + this.monthsShort(mom, '');
                this._monthsParse[i] = new RegExp(regex.replace('.', ''), 'i');
            }
            // test the regex
            if (strict && format === 'MMMM' && this._longMonthsParse[i].test(monthName)) {
                return i;
            } else if (strict && format === 'MMM' && this._shortMonthsParse[i].test(monthName)) {
                return i;
            } else if (!strict && this._monthsParse[i].test(monthName)) {
                return i;
            }
        }
    }

    // MOMENTS

    function setMonth (mom, value) {
        var dayOfMonth;

        if (!mom.isValid()) {
            // No op
            return mom;
        }

        if (typeof value === 'string') {
            if (/^\d+$/.test(value)) {
                value = toInt(value);
            } else {
                value = mom.localeData().monthsParse(value);
                // TODO: Another silent failure?
                if (!isNumber(value)) {
                    return mom;
                }
            }
        }

        dayOfMonth = Math.min(mom.date(), daysInMonth(mom.year(), value));
        mom._d['set' + (mom._isUTC ? 'UTC' : '') + 'Month'](value, dayOfMonth);
        return mom;
    }

    function getSetMonth (value) {
        if (value != null) {
            setMonth(this, value);
            hooks.updateOffset(this, true);
            return this;
        } else {
            return get(this, 'Month');
        }
    }

    function getDaysInMonth () {
        return daysInMonth(this.year(), this.month());
    }

    var defaultMonthsShortRegex = matchWord;
    function monthsShortRegex (isStrict) {
        if (this._monthsParseExact) {
            if (!hasOwnProp(this, '_monthsRegex')) {
                computeMonthsParse.call(this);
            }
            if (isStrict) {
                return this._monthsShortStrictRegex;
            } else {
                return this._monthsShortRegex;
            }
        } else {
            if (!hasOwnProp(this, '_monthsShortRegex')) {
                this._monthsShortRegex = defaultMonthsShortRegex;
            }
            return this._monthsShortStrictRegex && isStrict ?
                this._monthsShortStrictRegex : this._monthsShortRegex;
        }
    }

    var defaultMonthsRegex = matchWord;
    function monthsRegex (isStrict) {
        if (this._monthsParseExact) {
            if (!hasOwnProp(this, '_monthsRegex')) {
                computeMonthsParse.call(this);
            }
            if (isStrict) {
                return this._monthsStrictRegex;
            } else {
                return this._monthsRegex;
            }
        } else {
            if (!hasOwnProp(this, '_monthsRegex')) {
                this._monthsRegex = defaultMonthsRegex;
            }
            return this._monthsStrictRegex && isStrict ?
                this._monthsStrictRegex : this._monthsRegex;
        }
    }

    function computeMonthsParse () {
        function cmpLenRev(a, b) {
            return b.length - a.length;
        }

        var shortPieces = [], longPieces = [], mixedPieces = [],
            i, mom;
        for (i = 0; i < 12; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, i]);
            shortPieces.push(this.monthsShort(mom, ''));
            longPieces.push(this.months(mom, ''));
            mixedPieces.push(this.months(mom, ''));
            mixedPieces.push(this.monthsShort(mom, ''));
        }
        // Sorting makes sure if one month (or abbr) is a prefix of another it
        // will match the longer piece.
        shortPieces.sort(cmpLenRev);
        longPieces.sort(cmpLenRev);
        mixedPieces.sort(cmpLenRev);
        for (i = 0; i < 12; i++) {
            shortPieces[i] = regexEscape(shortPieces[i]);
            longPieces[i] = regexEscape(longPieces[i]);
        }
        for (i = 0; i < 24; i++) {
            mixedPieces[i] = regexEscape(mixedPieces[i]);
        }

        this._monthsRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
        this._monthsShortRegex = this._monthsRegex;
        this._monthsStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
        this._monthsShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
    }

    function createDate (y, m, d, h, M, s, ms) {
        // can't just apply() to create a date:
        // https://stackoverflow.com/q/181348
        var date;
        // the date constructor remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            date = new Date(y + 400, m, d, h, M, s, ms);
            if (isFinite(date.getFullYear())) {
                date.setFullYear(y);
            }
        } else {
            date = new Date(y, m, d, h, M, s, ms);
        }

        return date;
    }

    function createUTCDate (y) {
        var date;
        // the Date.UTC function remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            var args = Array.prototype.slice.call(arguments);
            // preserve leap years using a full 400 year cycle, then reset
            args[0] = y + 400;
            date = new Date(Date.UTC.apply(null, args));
            if (isFinite(date.getUTCFullYear())) {
                date.setUTCFullYear(y);
            }
        } else {
            date = new Date(Date.UTC.apply(null, arguments));
        }

        return date;
    }

    // start-of-first-week - start-of-year
    function firstWeekOffset(year, dow, doy) {
        var // first-week day -- which january is always in the first week (4 for iso, 1 for other)
            fwd = 7 + dow - doy,
            // first-week day local weekday -- which local weekday is fwd
            fwdlw = (7 + createUTCDate(year, 0, fwd).getUTCDay() - dow) % 7;

        return -fwdlw + fwd - 1;
    }

    // https://en.wikipedia.org/wiki/ISO_week_date#Calculating_a_date_given_the_year.2C_week_number_and_weekday
    function dayOfYearFromWeeks(year, week, weekday, dow, doy) {
        var localWeekday = (7 + weekday - dow) % 7,
            weekOffset = firstWeekOffset(year, dow, doy),
            dayOfYear = 1 + 7 * (week - 1) + localWeekday + weekOffset,
            resYear, resDayOfYear;

        if (dayOfYear <= 0) {
            resYear = year - 1;
            resDayOfYear = daysInYear(resYear) + dayOfYear;
        } else if (dayOfYear > daysInYear(year)) {
            resYear = year + 1;
            resDayOfYear = dayOfYear - daysInYear(year);
        } else {
            resYear = year;
            resDayOfYear = dayOfYear;
        }

        return {
            year: resYear,
            dayOfYear: resDayOfYear
        };
    }

    function weekOfYear(mom, dow, doy) {
        var weekOffset = firstWeekOffset(mom.year(), dow, doy),
            week = Math.floor((mom.dayOfYear() - weekOffset - 1) / 7) + 1,
            resWeek, resYear;

        if (week < 1) {
            resYear = mom.year() - 1;
            resWeek = week + weeksInYear(resYear, dow, doy);
        } else if (week > weeksInYear(mom.year(), dow, doy)) {
            resWeek = week - weeksInYear(mom.year(), dow, doy);
            resYear = mom.year() + 1;
        } else {
            resYear = mom.year();
            resWeek = week;
        }

        return {
            week: resWeek,
            year: resYear
        };
    }

    function weeksInYear(year, dow, doy) {
        var weekOffset = firstWeekOffset(year, dow, doy),
            weekOffsetNext = firstWeekOffset(year + 1, dow, doy);
        return (daysInYear(year) - weekOffset + weekOffsetNext) / 7;
    }

    // FORMATTING

    addFormatToken('w', ['ww', 2], 'wo', 'week');
    addFormatToken('W', ['WW', 2], 'Wo', 'isoWeek');

    // ALIASES

    addUnitAlias('week', 'w');
    addUnitAlias('isoWeek', 'W');

    // PRIORITIES

    addUnitPriority('week', 5);
    addUnitPriority('isoWeek', 5);

    // PARSING

    addRegexToken('w',  match1to2);
    addRegexToken('ww', match1to2, match2);
    addRegexToken('W',  match1to2);
    addRegexToken('WW', match1to2, match2);

    addWeekParseToken(['w', 'ww', 'W', 'WW'], function (input, week, config, token) {
        week[token.substr(0, 1)] = toInt(input);
    });

    // HELPERS

    // LOCALES

    function localeWeek (mom) {
        return weekOfYear(mom, this._week.dow, this._week.doy).week;
    }

    var defaultLocaleWeek = {
        dow : 0, // Sunday is the first day of the week.
        doy : 6  // The week that contains Jan 6th is the first week of the year.
    };

    function localeFirstDayOfWeek () {
        return this._week.dow;
    }

    function localeFirstDayOfYear () {
        return this._week.doy;
    }

    // MOMENTS

    function getSetWeek (input) {
        var week = this.localeData().week(this);
        return input == null ? week : this.add((input - week) * 7, 'd');
    }

    function getSetISOWeek (input) {
        var week = weekOfYear(this, 1, 4).week;
        return input == null ? week : this.add((input - week) * 7, 'd');
    }

    // FORMATTING

    addFormatToken('d', 0, 'do', 'day');

    addFormatToken('dd', 0, 0, function (format) {
        return this.localeData().weekdaysMin(this, format);
    });

    addFormatToken('ddd', 0, 0, function (format) {
        return this.localeData().weekdaysShort(this, format);
    });

    addFormatToken('dddd', 0, 0, function (format) {
        return this.localeData().weekdays(this, format);
    });

    addFormatToken('e', 0, 0, 'weekday');
    addFormatToken('E', 0, 0, 'isoWeekday');

    // ALIASES

    addUnitAlias('day', 'd');
    addUnitAlias('weekday', 'e');
    addUnitAlias('isoWeekday', 'E');

    // PRIORITY
    addUnitPriority('day', 11);
    addUnitPriority('weekday', 11);
    addUnitPriority('isoWeekday', 11);

    // PARSING

    addRegexToken('d',    match1to2);
    addRegexToken('e',    match1to2);
    addRegexToken('E',    match1to2);
    addRegexToken('dd',   function (isStrict, locale) {
        return locale.weekdaysMinRegex(isStrict);
    });
    addRegexToken('ddd',   function (isStrict, locale) {
        return locale.weekdaysShortRegex(isStrict);
    });
    addRegexToken('dddd',   function (isStrict, locale) {
        return locale.weekdaysRegex(isStrict);
    });

    addWeekParseToken(['dd', 'ddd', 'dddd'], function (input, week, config, token) {
        var weekday = config._locale.weekdaysParse(input, token, config._strict);
        // if we didn't get a weekday name, mark the date as invalid
        if (weekday != null) {
            week.d = weekday;
        } else {
            getParsingFlags(config).invalidWeekday = input;
        }
    });

    addWeekParseToken(['d', 'e', 'E'], function (input, week, config, token) {
        week[token] = toInt(input);
    });

    // HELPERS

    function parseWeekday(input, locale) {
        if (typeof input !== 'string') {
            return input;
        }

        if (!isNaN(input)) {
            return parseInt(input, 10);
        }

        input = locale.weekdaysParse(input);
        if (typeof input === 'number') {
            return input;
        }

        return null;
    }

    function parseIsoWeekday(input, locale) {
        if (typeof input === 'string') {
            return locale.weekdaysParse(input) % 7 || 7;
        }
        return isNaN(input) ? null : input;
    }

    // LOCALES
    function shiftWeekdays (ws, n) {
        return ws.slice(n, 7).concat(ws.slice(0, n));
    }

    var defaultLocaleWeekdays = 'Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday'.split('_');
    function localeWeekdays (m, format) {
        var weekdays = isArray(this._weekdays) ? this._weekdays :
            this._weekdays[(m && m !== true && this._weekdays.isFormat.test(format)) ? 'format' : 'standalone'];
        return (m === true) ? shiftWeekdays(weekdays, this._week.dow)
            : (m) ? weekdays[m.day()] : weekdays;
    }

    var defaultLocaleWeekdaysShort = 'Sun_Mon_Tue_Wed_Thu_Fri_Sat'.split('_');
    function localeWeekdaysShort (m) {
        return (m === true) ? shiftWeekdays(this._weekdaysShort, this._week.dow)
            : (m) ? this._weekdaysShort[m.day()] : this._weekdaysShort;
    }

    var defaultLocaleWeekdaysMin = 'Su_Mo_Tu_We_Th_Fr_Sa'.split('_');
    function localeWeekdaysMin (m) {
        return (m === true) ? shiftWeekdays(this._weekdaysMin, this._week.dow)
            : (m) ? this._weekdaysMin[m.day()] : this._weekdaysMin;
    }

    function handleStrictParse$1(weekdayName, format, strict) {
        var i, ii, mom, llc = weekdayName.toLocaleLowerCase();
        if (!this._weekdaysParse) {
            this._weekdaysParse = [];
            this._shortWeekdaysParse = [];
            this._minWeekdaysParse = [];

            for (i = 0; i < 7; ++i) {
                mom = createUTC([2000, 1]).day(i);
                this._minWeekdaysParse[i] = this.weekdaysMin(mom, '').toLocaleLowerCase();
                this._shortWeekdaysParse[i] = this.weekdaysShort(mom, '').toLocaleLowerCase();
                this._weekdaysParse[i] = this.weekdays(mom, '').toLocaleLowerCase();
            }
        }

        if (strict) {
            if (format === 'dddd') {
                ii = indexOf.call(this._weekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else if (format === 'ddd') {
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            }
        } else {
            if (format === 'dddd') {
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else if (format === 'ddd') {
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._minWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            }
        }
    }

    function localeWeekdaysParse (weekdayName, format, strict) {
        var i, mom, regex;

        if (this._weekdaysParseExact) {
            return handleStrictParse$1.call(this, weekdayName, format, strict);
        }

        if (!this._weekdaysParse) {
            this._weekdaysParse = [];
            this._minWeekdaysParse = [];
            this._shortWeekdaysParse = [];
            this._fullWeekdaysParse = [];
        }

        for (i = 0; i < 7; i++) {
            // make the regex if we don't have it already

            mom = createUTC([2000, 1]).day(i);
            if (strict && !this._fullWeekdaysParse[i]) {
                this._fullWeekdaysParse[i] = new RegExp('^' + this.weekdays(mom, '').replace('.', '\\.?') + '$', 'i');
                this._shortWeekdaysParse[i] = new RegExp('^' + this.weekdaysShort(mom, '').replace('.', '\\.?') + '$', 'i');
                this._minWeekdaysParse[i] = new RegExp('^' + this.weekdaysMin(mom, '').replace('.', '\\.?') + '$', 'i');
            }
            if (!this._weekdaysParse[i]) {
                regex = '^' + this.weekdays(mom, '') + '|^' + this.weekdaysShort(mom, '') + '|^' + this.weekdaysMin(mom, '');
                this._weekdaysParse[i] = new RegExp(regex.replace('.', ''), 'i');
            }
            // test the regex
            if (strict && format === 'dddd' && this._fullWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (strict && format === 'ddd' && this._shortWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (strict && format === 'dd' && this._minWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (!strict && this._weekdaysParse[i].test(weekdayName)) {
                return i;
            }
        }
    }

    // MOMENTS

    function getSetDayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        var day = this._isUTC ? this._d.getUTCDay() : this._d.getDay();
        if (input != null) {
            input = parseWeekday(input, this.localeData());
            return this.add(input - day, 'd');
        } else {
            return day;
        }
    }

    function getSetLocaleDayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        var weekday = (this.day() + 7 - this.localeData()._week.dow) % 7;
        return input == null ? weekday : this.add(input - weekday, 'd');
    }

    function getSetISODayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }

        // behaves the same as moment#day except
        // as a getter, returns 7 instead of 0 (1-7 range instead of 0-6)
        // as a setter, sunday should belong to the previous week.

        if (input != null) {
            var weekday = parseIsoWeekday(input, this.localeData());
            return this.day(this.day() % 7 ? weekday : weekday - 7);
        } else {
            return this.day() || 7;
        }
    }

    var defaultWeekdaysRegex = matchWord;
    function weekdaysRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysStrictRegex;
            } else {
                return this._weekdaysRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                this._weekdaysRegex = defaultWeekdaysRegex;
            }
            return this._weekdaysStrictRegex && isStrict ?
                this._weekdaysStrictRegex : this._weekdaysRegex;
        }
    }

    var defaultWeekdaysShortRegex = matchWord;
    function weekdaysShortRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysShortStrictRegex;
            } else {
                return this._weekdaysShortRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysShortRegex')) {
                this._weekdaysShortRegex = defaultWeekdaysShortRegex;
            }
            return this._weekdaysShortStrictRegex && isStrict ?
                this._weekdaysShortStrictRegex : this._weekdaysShortRegex;
        }
    }

    var defaultWeekdaysMinRegex = matchWord;
    function weekdaysMinRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysMinStrictRegex;
            } else {
                return this._weekdaysMinRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysMinRegex')) {
                this._weekdaysMinRegex = defaultWeekdaysMinRegex;
            }
            return this._weekdaysMinStrictRegex && isStrict ?
                this._weekdaysMinStrictRegex : this._weekdaysMinRegex;
        }
    }


    function computeWeekdaysParse () {
        function cmpLenRev(a, b) {
            return b.length - a.length;
        }

        var minPieces = [], shortPieces = [], longPieces = [], mixedPieces = [],
            i, mom, minp, shortp, longp;
        for (i = 0; i < 7; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, 1]).day(i);
            minp = this.weekdaysMin(mom, '');
            shortp = this.weekdaysShort(mom, '');
            longp = this.weekdays(mom, '');
            minPieces.push(minp);
            shortPieces.push(shortp);
            longPieces.push(longp);
            mixedPieces.push(minp);
            mixedPieces.push(shortp);
            mixedPieces.push(longp);
        }
        // Sorting makes sure if one weekday (or abbr) is a prefix of another it
        // will match the longer piece.
        minPieces.sort(cmpLenRev);
        shortPieces.sort(cmpLenRev);
        longPieces.sort(cmpLenRev);
        mixedPieces.sort(cmpLenRev);
        for (i = 0; i < 7; i++) {
            shortPieces[i] = regexEscape(shortPieces[i]);
            longPieces[i] = regexEscape(longPieces[i]);
            mixedPieces[i] = regexEscape(mixedPieces[i]);
        }

        this._weekdaysRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
        this._weekdaysShortRegex = this._weekdaysRegex;
        this._weekdaysMinRegex = this._weekdaysRegex;

        this._weekdaysStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
        this._weekdaysShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
        this._weekdaysMinStrictRegex = new RegExp('^(' + minPieces.join('|') + ')', 'i');
    }

    // FORMATTING

    function hFormat() {
        return this.hours() % 12 || 12;
    }

    function kFormat() {
        return this.hours() || 24;
    }

    addFormatToken('H', ['HH', 2], 0, 'hour');
    addFormatToken('h', ['hh', 2], 0, hFormat);
    addFormatToken('k', ['kk', 2], 0, kFormat);

    addFormatToken('hmm', 0, 0, function () {
        return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2);
    });

    addFormatToken('hmmss', 0, 0, function () {
        return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2) +
            zeroFill(this.seconds(), 2);
    });

    addFormatToken('Hmm', 0, 0, function () {
        return '' + this.hours() + zeroFill(this.minutes(), 2);
    });

    addFormatToken('Hmmss', 0, 0, function () {
        return '' + this.hours() + zeroFill(this.minutes(), 2) +
            zeroFill(this.seconds(), 2);
    });

    function meridiem (token, lowercase) {
        addFormatToken(token, 0, 0, function () {
            return this.localeData().meridiem(this.hours(), this.minutes(), lowercase);
        });
    }

    meridiem('a', true);
    meridiem('A', false);

    // ALIASES

    addUnitAlias('hour', 'h');

    // PRIORITY
    addUnitPriority('hour', 13);

    // PARSING

    function matchMeridiem (isStrict, locale) {
        return locale._meridiemParse;
    }

    addRegexToken('a',  matchMeridiem);
    addRegexToken('A',  matchMeridiem);
    addRegexToken('H',  match1to2);
    addRegexToken('h',  match1to2);
    addRegexToken('k',  match1to2);
    addRegexToken('HH', match1to2, match2);
    addRegexToken('hh', match1to2, match2);
    addRegexToken('kk', match1to2, match2);

    addRegexToken('hmm', match3to4);
    addRegexToken('hmmss', match5to6);
    addRegexToken('Hmm', match3to4);
    addRegexToken('Hmmss', match5to6);

    addParseToken(['H', 'HH'], HOUR);
    addParseToken(['k', 'kk'], function (input, array, config) {
        var kInput = toInt(input);
        array[HOUR] = kInput === 24 ? 0 : kInput;
    });
    addParseToken(['a', 'A'], function (input, array, config) {
        config._isPm = config._locale.isPM(input);
        config._meridiem = input;
    });
    addParseToken(['h', 'hh'], function (input, array, config) {
        array[HOUR] = toInt(input);
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('hmm', function (input, array, config) {
        var pos = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos));
        array[MINUTE] = toInt(input.substr(pos));
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('hmmss', function (input, array, config) {
        var pos1 = input.length - 4;
        var pos2 = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos1));
        array[MINUTE] = toInt(input.substr(pos1, 2));
        array[SECOND] = toInt(input.substr(pos2));
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('Hmm', function (input, array, config) {
        var pos = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos));
        array[MINUTE] = toInt(input.substr(pos));
    });
    addParseToken('Hmmss', function (input, array, config) {
        var pos1 = input.length - 4;
        var pos2 = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos1));
        array[MINUTE] = toInt(input.substr(pos1, 2));
        array[SECOND] = toInt(input.substr(pos2));
    });

    // LOCALES

    function localeIsPM (input) {
        // IE8 Quirks Mode & IE7 Standards Mode do not allow accessing strings like arrays
        // Using charAt should be more compatible.
        return ((input + '').toLowerCase().charAt(0) === 'p');
    }

    var defaultLocaleMeridiemParse = /[ap]\.?m?\.?/i;
    function localeMeridiem (hours, minutes, isLower) {
        if (hours > 11) {
            return isLower ? 'pm' : 'PM';
        } else {
            return isLower ? 'am' : 'AM';
        }
    }


    // MOMENTS

    // Setting the hour should keep the time, because the user explicitly
    // specified which hour they want. So trying to maintain the same hour (in
    // a new timezone) makes sense. Adding/subtracting hours does not follow
    // this rule.
    var getSetHour = makeGetSet('Hours', true);

    var baseConfig = {
        calendar: defaultCalendar,
        longDateFormat: defaultLongDateFormat,
        invalidDate: defaultInvalidDate,
        ordinal: defaultOrdinal,
        dayOfMonthOrdinalParse: defaultDayOfMonthOrdinalParse,
        relativeTime: defaultRelativeTime,

        months: defaultLocaleMonths,
        monthsShort: defaultLocaleMonthsShort,

        week: defaultLocaleWeek,

        weekdays: defaultLocaleWeekdays,
        weekdaysMin: defaultLocaleWeekdaysMin,
        weekdaysShort: defaultLocaleWeekdaysShort,

        meridiemParse: defaultLocaleMeridiemParse
    };

    // internal storage for locale config files
    var locales = {};
    var localeFamilies = {};
    var globalLocale;

    function normalizeLocale(key) {
        return key ? key.toLowerCase().replace('_', '-') : key;
    }

    // pick the locale from the array
    // try ['en-au', 'en-gb'] as 'en-au', 'en-gb', 'en', as in move through the list trying each
    // substring from most specific to least, but move to the next array item if it's a more specific variant than the current root
    function chooseLocale(names) {
        var i = 0, j, next, locale, split;

        while (i < names.length) {
            split = normalizeLocale(names[i]).split('-');
            j = split.length;
            next = normalizeLocale(names[i + 1]);
            next = next ? next.split('-') : null;
            while (j > 0) {
                locale = loadLocale(split.slice(0, j).join('-'));
                if (locale) {
                    return locale;
                }
                if (next && next.length >= j && compareArrays(split, next, true) >= j - 1) {
                    //the next array item is better than a shallower substring of this one
                    break;
                }
                j--;
            }
            i++;
        }
        return globalLocale;
    }

    function loadLocale(name) {
        var oldLocale = null;
        // TODO: Find a better way to register and load all the locales in Node
        if (!locales[name] && (typeof module !== 'undefined') &&
                module && module.exports) {
            try {
                oldLocale = globalLocale._abbr;
                var aliasedRequire = require;
                aliasedRequire('./locale/' + name);
                getSetGlobalLocale(oldLocale);
            } catch (e) {}
        }
        return locales[name];
    }

    // This function will load locale and then set the global locale.  If
    // no arguments are passed in, it will simply return the current global
    // locale key.
    function getSetGlobalLocale (key, values) {
        var data;
        if (key) {
            if (isUndefined(values)) {
                data = getLocale(key);
            }
            else {
                data = defineLocale(key, values);
            }

            if (data) {
                // moment.duration._locale = moment._locale = data;
                globalLocale = data;
            }
            else {
                if ((typeof console !==  'undefined') && console.warn) {
                    //warn user if arguments are passed but the locale could not be set
                    console.warn('Locale ' + key +  ' not found. Did you forget to load it?');
                }
            }
        }

        return globalLocale._abbr;
    }

    function defineLocale (name, config) {
        if (config !== null) {
            var locale, parentConfig = baseConfig;
            config.abbr = name;
            if (locales[name] != null) {
                deprecateSimple('defineLocaleOverride',
                        'use moment.updateLocale(localeName, config) to change ' +
                        'an existing locale. moment.defineLocale(localeName, ' +
                        'config) should only be used for creating a new locale ' +
                        'See http://momentjs.com/guides/#/warnings/define-locale/ for more info.');
                parentConfig = locales[name]._config;
            } else if (config.parentLocale != null) {
                if (locales[config.parentLocale] != null) {
                    parentConfig = locales[config.parentLocale]._config;
                } else {
                    locale = loadLocale(config.parentLocale);
                    if (locale != null) {
                        parentConfig = locale._config;
                    } else {
                        if (!localeFamilies[config.parentLocale]) {
                            localeFamilies[config.parentLocale] = [];
                        }
                        localeFamilies[config.parentLocale].push({
                            name: name,
                            config: config
                        });
                        return null;
                    }
                }
            }
            locales[name] = new Locale(mergeConfigs(parentConfig, config));

            if (localeFamilies[name]) {
                localeFamilies[name].forEach(function (x) {
                    defineLocale(x.name, x.config);
                });
            }

            // backwards compat for now: also set the locale
            // make sure we set the locale AFTER all child locales have been
            // created, so we won't end up with the child locale set.
            getSetGlobalLocale(name);


            return locales[name];
        } else {
            // useful for testing
            delete locales[name];
            return null;
        }
    }

    function updateLocale(name, config) {
        if (config != null) {
            var locale, tmpLocale, parentConfig = baseConfig;
            // MERGE
            tmpLocale = loadLocale(name);
            if (tmpLocale != null) {
                parentConfig = tmpLocale._config;
            }
            config = mergeConfigs(parentConfig, config);
            locale = new Locale(config);
            locale.parentLocale = locales[name];
            locales[name] = locale;

            // backwards compat for now: also set the locale
            getSetGlobalLocale(name);
        } else {
            // pass null for config to unupdate, useful for tests
            if (locales[name] != null) {
                if (locales[name].parentLocale != null) {
                    locales[name] = locales[name].parentLocale;
                } else if (locales[name] != null) {
                    delete locales[name];
                }
            }
        }
        return locales[name];
    }

    // returns locale data
    function getLocale (key) {
        var locale;

        if (key && key._locale && key._locale._abbr) {
            key = key._locale._abbr;
        }

        if (!key) {
            return globalLocale;
        }

        if (!isArray(key)) {
            //short-circuit everything else
            locale = loadLocale(key);
            if (locale) {
                return locale;
            }
            key = [key];
        }

        return chooseLocale(key);
    }

    function listLocales() {
        return keys(locales);
    }

    function checkOverflow (m) {
        var overflow;
        var a = m._a;

        if (a && getParsingFlags(m).overflow === -2) {
            overflow =
                a[MONTH]       < 0 || a[MONTH]       > 11  ? MONTH :
                a[DATE]        < 1 || a[DATE]        > daysInMonth(a[YEAR], a[MONTH]) ? DATE :
                a[HOUR]        < 0 || a[HOUR]        > 24 || (a[HOUR] === 24 && (a[MINUTE] !== 0 || a[SECOND] !== 0 || a[MILLISECOND] !== 0)) ? HOUR :
                a[MINUTE]      < 0 || a[MINUTE]      > 59  ? MINUTE :
                a[SECOND]      < 0 || a[SECOND]      > 59  ? SECOND :
                a[MILLISECOND] < 0 || a[MILLISECOND] > 999 ? MILLISECOND :
                -1;

            if (getParsingFlags(m)._overflowDayOfYear && (overflow < YEAR || overflow > DATE)) {
                overflow = DATE;
            }
            if (getParsingFlags(m)._overflowWeeks && overflow === -1) {
                overflow = WEEK;
            }
            if (getParsingFlags(m)._overflowWeekday && overflow === -1) {
                overflow = WEEKDAY;
            }

            getParsingFlags(m).overflow = overflow;
        }

        return m;
    }

    // Pick the first defined of two or three arguments.
    function defaults(a, b, c) {
        if (a != null) {
            return a;
        }
        if (b != null) {
            return b;
        }
        return c;
    }

    function currentDateArray(config) {
        // hooks is actually the exported moment object
        var nowValue = new Date(hooks.now());
        if (config._useUTC) {
            return [nowValue.getUTCFullYear(), nowValue.getUTCMonth(), nowValue.getUTCDate()];
        }
        return [nowValue.getFullYear(), nowValue.getMonth(), nowValue.getDate()];
    }

    // convert an array to a date.
    // the array should mirror the parameters below
    // note: all values past the year are optional and will default to the lowest possible value.
    // [year, month, day , hour, minute, second, millisecond]
    function configFromArray (config) {
        var i, date, input = [], currentDate, expectedWeekday, yearToUse;

        if (config._d) {
            return;
        }

        currentDate = currentDateArray(config);

        //compute day of the year from weeks and weekdays
        if (config._w && config._a[DATE] == null && config._a[MONTH] == null) {
            dayOfYearFromWeekInfo(config);
        }

        //if the day of the year is set, figure out what it is
        if (config._dayOfYear != null) {
            yearToUse = defaults(config._a[YEAR], currentDate[YEAR]);

            if (config._dayOfYear > daysInYear(yearToUse) || config._dayOfYear === 0) {
                getParsingFlags(config)._overflowDayOfYear = true;
            }

            date = createUTCDate(yearToUse, 0, config._dayOfYear);
            config._a[MONTH] = date.getUTCMonth();
            config._a[DATE] = date.getUTCDate();
        }

        // Default to current date.
        // * if no year, month, day of month are given, default to today
        // * if day of month is given, default month and year
        // * if month is given, default only year
        // * if year is given, don't default anything
        for (i = 0; i < 3 && config._a[i] == null; ++i) {
            config._a[i] = input[i] = currentDate[i];
        }

        // Zero out whatever was not defaulted, including time
        for (; i < 7; i++) {
            config._a[i] = input[i] = (config._a[i] == null) ? (i === 2 ? 1 : 0) : config._a[i];
        }

        // Check for 24:00:00.000
        if (config._a[HOUR] === 24 &&
                config._a[MINUTE] === 0 &&
                config._a[SECOND] === 0 &&
                config._a[MILLISECOND] === 0) {
            config._nextDay = true;
            config._a[HOUR] = 0;
        }

        config._d = (config._useUTC ? createUTCDate : createDate).apply(null, input);
        expectedWeekday = config._useUTC ? config._d.getUTCDay() : config._d.getDay();

        // Apply timezone offset from input. The actual utcOffset can be changed
        // with parseZone.
        if (config._tzm != null) {
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);
        }

        if (config._nextDay) {
            config._a[HOUR] = 24;
        }

        // check for mismatching day of week
        if (config._w && typeof config._w.d !== 'undefined' && config._w.d !== expectedWeekday) {
            getParsingFlags(config).weekdayMismatch = true;
        }
    }

    function dayOfYearFromWeekInfo(config) {
        var w, weekYear, week, weekday, dow, doy, temp, weekdayOverflow;

        w = config._w;
        if (w.GG != null || w.W != null || w.E != null) {
            dow = 1;
            doy = 4;

            // TODO: We need to take the current isoWeekYear, but that depends on
            // how we interpret now (local, utc, fixed offset). So create
            // a now version of current config (take local/utc/offset flags, and
            // create now).
            weekYear = defaults(w.GG, config._a[YEAR], weekOfYear(createLocal(), 1, 4).year);
            week = defaults(w.W, 1);
            weekday = defaults(w.E, 1);
            if (weekday < 1 || weekday > 7) {
                weekdayOverflow = true;
            }
        } else {
            dow = config._locale._week.dow;
            doy = config._locale._week.doy;

            var curWeek = weekOfYear(createLocal(), dow, doy);

            weekYear = defaults(w.gg, config._a[YEAR], curWeek.year);

            // Default to current week.
            week = defaults(w.w, curWeek.week);

            if (w.d != null) {
                // weekday -- low day numbers are considered next week
                weekday = w.d;
                if (weekday < 0 || weekday > 6) {
                    weekdayOverflow = true;
                }
            } else if (w.e != null) {
                // local weekday -- counting starts from beginning of week
                weekday = w.e + dow;
                if (w.e < 0 || w.e > 6) {
                    weekdayOverflow = true;
                }
            } else {
                // default to beginning of week
                weekday = dow;
            }
        }
        if (week < 1 || week > weeksInYear(weekYear, dow, doy)) {
            getParsingFlags(config)._overflowWeeks = true;
        } else if (weekdayOverflow != null) {
            getParsingFlags(config)._overflowWeekday = true;
        } else {
            temp = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy);
            config._a[YEAR] = temp.year;
            config._dayOfYear = temp.dayOfYear;
        }
    }

    // iso 8601 regex
    // 0000-00-00 0000-W00 or 0000-W00-0 + T + 00 or 00:00 or 00:00:00 or 00:00:00.000 + +00:00 or +0000 or +00)
    var extendedIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})-(?:\d\d-\d\d|W\d\d-\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?::\d\d(?::\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/;
    var basicIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})(?:\d\d\d\d|W\d\d\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?:\d\d(?:\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/;

    var tzRegex = /Z|[+-]\d\d(?::?\d\d)?/;

    var isoDates = [
        ['YYYYYY-MM-DD', /[+-]\d{6}-\d\d-\d\d/],
        ['YYYY-MM-DD', /\d{4}-\d\d-\d\d/],
        ['GGGG-[W]WW-E', /\d{4}-W\d\d-\d/],
        ['GGGG-[W]WW', /\d{4}-W\d\d/, false],
        ['YYYY-DDD', /\d{4}-\d{3}/],
        ['YYYY-MM', /\d{4}-\d\d/, false],
        ['YYYYYYMMDD', /[+-]\d{10}/],
        ['YYYYMMDD', /\d{8}/],
        // YYYYMM is NOT allowed by the standard
        ['GGGG[W]WWE', /\d{4}W\d{3}/],
        ['GGGG[W]WW', /\d{4}W\d{2}/, false],
        ['YYYYDDD', /\d{7}/]
    ];

    // iso time formats and regexes
    var isoTimes = [
        ['HH:mm:ss.SSSS', /\d\d:\d\d:\d\d\.\d+/],
        ['HH:mm:ss,SSSS', /\d\d:\d\d:\d\d,\d+/],
        ['HH:mm:ss', /\d\d:\d\d:\d\d/],
        ['HH:mm', /\d\d:\d\d/],
        ['HHmmss.SSSS', /\d\d\d\d\d\d\.\d+/],
        ['HHmmss,SSSS', /\d\d\d\d\d\d,\d+/],
        ['HHmmss', /\d\d\d\d\d\d/],
        ['HHmm', /\d\d\d\d/],
        ['HH', /\d\d/]
    ];

    var aspNetJsonRegex = /^\/?Date\((\-?\d+)/i;

    // date from iso format
    function configFromISO(config) {
        var i, l,
            string = config._i,
            match = extendedIsoRegex.exec(string) || basicIsoRegex.exec(string),
            allowTime, dateFormat, timeFormat, tzFormat;

        if (match) {
            getParsingFlags(config).iso = true;

            for (i = 0, l = isoDates.length; i < l; i++) {
                if (isoDates[i][1].exec(match[1])) {
                    dateFormat = isoDates[i][0];
                    allowTime = isoDates[i][2] !== false;
                    break;
                }
            }
            if (dateFormat == null) {
                config._isValid = false;
                return;
            }
            if (match[3]) {
                for (i = 0, l = isoTimes.length; i < l; i++) {
                    if (isoTimes[i][1].exec(match[3])) {
                        // match[2] should be 'T' or space
                        timeFormat = (match[2] || ' ') + isoTimes[i][0];
                        break;
                    }
                }
                if (timeFormat == null) {
                    config._isValid = false;
                    return;
                }
            }
            if (!allowTime && timeFormat != null) {
                config._isValid = false;
                return;
            }
            if (match[4]) {
                if (tzRegex.exec(match[4])) {
                    tzFormat = 'Z';
                } else {
                    config._isValid = false;
                    return;
                }
            }
            config._f = dateFormat + (timeFormat || '') + (tzFormat || '');
            configFromStringAndFormat(config);
        } else {
            config._isValid = false;
        }
    }

    // RFC 2822 regex: For details see https://tools.ietf.org/html/rfc2822#section-3.3
    var rfc2822 = /^(?:(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s)?(\d{1,2})\s(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s(\d{2,4})\s(\d\d):(\d\d)(?::(\d\d))?\s(?:(UT|GMT|[ECMP][SD]T)|([Zz])|([+-]\d{4}))$/;

    function extractFromRFC2822Strings(yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr) {
        var result = [
            untruncateYear(yearStr),
            defaultLocaleMonthsShort.indexOf(monthStr),
            parseInt(dayStr, 10),
            parseInt(hourStr, 10),
            parseInt(minuteStr, 10)
        ];

        if (secondStr) {
            result.push(parseInt(secondStr, 10));
        }

        return result;
    }

    function untruncateYear(yearStr) {
        var year = parseInt(yearStr, 10);
        if (year <= 49) {
            return 2000 + year;
        } else if (year <= 999) {
            return 1900 + year;
        }
        return year;
    }

    function preprocessRFC2822(s) {
        // Remove comments and folding whitespace and replace multiple-spaces with a single space
        return s.replace(/\([^)]*\)|[\n\t]/g, ' ').replace(/(\s\s+)/g, ' ').replace(/^\s\s*/, '').replace(/\s\s*$/, '');
    }

    function checkWeekday(weekdayStr, parsedInput, config) {
        if (weekdayStr) {
            // TODO: Replace the vanilla JS Date object with an indepentent day-of-week check.
            var weekdayProvided = defaultLocaleWeekdaysShort.indexOf(weekdayStr),
                weekdayActual = new Date(parsedInput[0], parsedInput[1], parsedInput[2]).getDay();
            if (weekdayProvided !== weekdayActual) {
                getParsingFlags(config).weekdayMismatch = true;
                config._isValid = false;
                return false;
            }
        }
        return true;
    }

    var obsOffsets = {
        UT: 0,
        GMT: 0,
        EDT: -4 * 60,
        EST: -5 * 60,
        CDT: -5 * 60,
        CST: -6 * 60,
        MDT: -6 * 60,
        MST: -7 * 60,
        PDT: -7 * 60,
        PST: -8 * 60
    };

    function calculateOffset(obsOffset, militaryOffset, numOffset) {
        if (obsOffset) {
            return obsOffsets[obsOffset];
        } else if (militaryOffset) {
            // the only allowed military tz is Z
            return 0;
        } else {
            var hm = parseInt(numOffset, 10);
            var m = hm % 100, h = (hm - m) / 100;
            return h * 60 + m;
        }
    }

    // date and time from ref 2822 format
    function configFromRFC2822(config) {
        var match = rfc2822.exec(preprocessRFC2822(config._i));
        if (match) {
            var parsedArray = extractFromRFC2822Strings(match[4], match[3], match[2], match[5], match[6], match[7]);
            if (!checkWeekday(match[1], parsedArray, config)) {
                return;
            }

            config._a = parsedArray;
            config._tzm = calculateOffset(match[8], match[9], match[10]);

            config._d = createUTCDate.apply(null, config._a);
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);

            getParsingFlags(config).rfc2822 = true;
        } else {
            config._isValid = false;
        }
    }

    // date from iso format or fallback
    function configFromString(config) {
        var matched = aspNetJsonRegex.exec(config._i);

        if (matched !== null) {
            config._d = new Date(+matched[1]);
            return;
        }

        configFromISO(config);
        if (config._isValid === false) {
            delete config._isValid;
        } else {
            return;
        }

        configFromRFC2822(config);
        if (config._isValid === false) {
            delete config._isValid;
        } else {
            return;
        }

        // Final attempt, use Input Fallback
        hooks.createFromInputFallback(config);
    }

    hooks.createFromInputFallback = deprecate(
        'value provided is not in a recognized RFC2822 or ISO format. moment construction falls back to js Date(), ' +
        'which is not reliable across all browsers and versions. Non RFC2822/ISO date formats are ' +
        'discouraged and will be removed in an upcoming major release. Please refer to ' +
        'http://momentjs.com/guides/#/warnings/js-date/ for more info.',
        function (config) {
            config._d = new Date(config._i + (config._useUTC ? ' UTC' : ''));
        }
    );

    // constant that refers to the ISO standard
    hooks.ISO_8601 = function () {};

    // constant that refers to the RFC 2822 form
    hooks.RFC_2822 = function () {};

    // date from string and format string
    function configFromStringAndFormat(config) {
        // TODO: Move this to another part of the creation flow to prevent circular deps
        if (config._f === hooks.ISO_8601) {
            configFromISO(config);
            return;
        }
        if (config._f === hooks.RFC_2822) {
            configFromRFC2822(config);
            return;
        }
        config._a = [];
        getParsingFlags(config).empty = true;

        // This array is used to make a Date, either with `new Date` or `Date.UTC`
        var string = '' + config._i,
            i, parsedInput, tokens, token, skipped,
            stringLength = string.length,
            totalParsedInputLength = 0;

        tokens = expandFormat(config._f, config._locale).match(formattingTokens) || [];

        for (i = 0; i < tokens.length; i++) {
            token = tokens[i];
            parsedInput = (string.match(getParseRegexForToken(token, config)) || [])[0];
            // console.log('token', token, 'parsedInput', parsedInput,
            //         'regex', getParseRegexForToken(token, config));
            if (parsedInput) {
                skipped = string.substr(0, string.indexOf(parsedInput));
                if (skipped.length > 0) {
                    getParsingFlags(config).unusedInput.push(skipped);
                }
                string = string.slice(string.indexOf(parsedInput) + parsedInput.length);
                totalParsedInputLength += parsedInput.length;
            }
            // don't parse if it's not a known token
            if (formatTokenFunctions[token]) {
                if (parsedInput) {
                    getParsingFlags(config).empty = false;
                }
                else {
                    getParsingFlags(config).unusedTokens.push(token);
                }
                addTimeToArrayFromToken(token, parsedInput, config);
            }
            else if (config._strict && !parsedInput) {
                getParsingFlags(config).unusedTokens.push(token);
            }
        }

        // add remaining unparsed input length to the string
        getParsingFlags(config).charsLeftOver = stringLength - totalParsedInputLength;
        if (string.length > 0) {
            getParsingFlags(config).unusedInput.push(string);
        }

        // clear _12h flag if hour is <= 12
        if (config._a[HOUR] <= 12 &&
            getParsingFlags(config).bigHour === true &&
            config._a[HOUR] > 0) {
            getParsingFlags(config).bigHour = undefined;
        }

        getParsingFlags(config).parsedDateParts = config._a.slice(0);
        getParsingFlags(config).meridiem = config._meridiem;
        // handle meridiem
        config._a[HOUR] = meridiemFixWrap(config._locale, config._a[HOUR], config._meridiem);

        configFromArray(config);
        checkOverflow(config);
    }


    function meridiemFixWrap (locale, hour, meridiem) {
        var isPm;

        if (meridiem == null) {
            // nothing to do
            return hour;
        }
        if (locale.meridiemHour != null) {
            return locale.meridiemHour(hour, meridiem);
        } else if (locale.isPM != null) {
            // Fallback
            isPm = locale.isPM(meridiem);
            if (isPm && hour < 12) {
                hour += 12;
            }
            if (!isPm && hour === 12) {
                hour = 0;
            }
            return hour;
        } else {
            // this is not supposed to happen
            return hour;
        }
    }

    // date from string and array of format strings
    function configFromStringAndArray(config) {
        var tempConfig,
            bestMoment,

            scoreToBeat,
            i,
            currentScore;

        if (config._f.length === 0) {
            getParsingFlags(config).invalidFormat = true;
            config._d = new Date(NaN);
            return;
        }

        for (i = 0; i < config._f.length; i++) {
            currentScore = 0;
            tempConfig = copyConfig({}, config);
            if (config._useUTC != null) {
                tempConfig._useUTC = config._useUTC;
            }
            tempConfig._f = config._f[i];
            configFromStringAndFormat(tempConfig);

            if (!isValid(tempConfig)) {
                continue;
            }

            // if there is any input that was not parsed add a penalty for that format
            currentScore += getParsingFlags(tempConfig).charsLeftOver;

            //or tokens
            currentScore += getParsingFlags(tempConfig).unusedTokens.length * 10;

            getParsingFlags(tempConfig).score = currentScore;

            if (scoreToBeat == null || currentScore < scoreToBeat) {
                scoreToBeat = currentScore;
                bestMoment = tempConfig;
            }
        }

        extend(config, bestMoment || tempConfig);
    }

    function configFromObject(config) {
        if (config._d) {
            return;
        }

        var i = normalizeObjectUnits(config._i);
        config._a = map([i.year, i.month, i.day || i.date, i.hour, i.minute, i.second, i.millisecond], function (obj) {
            return obj && parseInt(obj, 10);
        });

        configFromArray(config);
    }

    function createFromConfig (config) {
        var res = new Moment(checkOverflow(prepareConfig(config)));
        if (res._nextDay) {
            // Adding is smart enough around DST
            res.add(1, 'd');
            res._nextDay = undefined;
        }

        return res;
    }

    function prepareConfig (config) {
        var input = config._i,
            format = config._f;

        config._locale = config._locale || getLocale(config._l);

        if (input === null || (format === undefined && input === '')) {
            return createInvalid({nullInput: true});
        }

        if (typeof input === 'string') {
            config._i = input = config._locale.preparse(input);
        }

        if (isMoment(input)) {
            return new Moment(checkOverflow(input));
        } else if (isDate(input)) {
            config._d = input;
        } else if (isArray(format)) {
            configFromStringAndArray(config);
        } else if (format) {
            configFromStringAndFormat(config);
        }  else {
            configFromInput(config);
        }

        if (!isValid(config)) {
            config._d = null;
        }

        return config;
    }

    function configFromInput(config) {
        var input = config._i;
        if (isUndefined(input)) {
            config._d = new Date(hooks.now());
        } else if (isDate(input)) {
            config._d = new Date(input.valueOf());
        } else if (typeof input === 'string') {
            configFromString(config);
        } else if (isArray(input)) {
            config._a = map(input.slice(0), function (obj) {
                return parseInt(obj, 10);
            });
            configFromArray(config);
        } else if (isObject(input)) {
            configFromObject(config);
        } else if (isNumber(input)) {
            // from milliseconds
            config._d = new Date(input);
        } else {
            hooks.createFromInputFallback(config);
        }
    }

    function createLocalOrUTC (input, format, locale, strict, isUTC) {
        var c = {};

        if (locale === true || locale === false) {
            strict = locale;
            locale = undefined;
        }

        if ((isObject(input) && isObjectEmpty(input)) ||
                (isArray(input) && input.length === 0)) {
            input = undefined;
        }
        // object construction must be done this way.
        // https://github.com/moment/moment/issues/1423
        c._isAMomentObject = true;
        c._useUTC = c._isUTC = isUTC;
        c._l = locale;
        c._i = input;
        c._f = format;
        c._strict = strict;

        return createFromConfig(c);
    }

    function createLocal (input, format, locale, strict) {
        return createLocalOrUTC(input, format, locale, strict, false);
    }

    var prototypeMin = deprecate(
        'moment().min is deprecated, use moment.max instead. http://momentjs.com/guides/#/warnings/min-max/',
        function () {
            var other = createLocal.apply(null, arguments);
            if (this.isValid() && other.isValid()) {
                return other < this ? this : other;
            } else {
                return createInvalid();
            }
        }
    );

    var prototypeMax = deprecate(
        'moment().max is deprecated, use moment.min instead. http://momentjs.com/guides/#/warnings/min-max/',
        function () {
            var other = createLocal.apply(null, arguments);
            if (this.isValid() && other.isValid()) {
                return other > this ? this : other;
            } else {
                return createInvalid();
            }
        }
    );

    // Pick a moment m from moments so that m[fn](other) is true for all
    // other. This relies on the function fn to be transitive.
    //
    // moments should either be an array of moment objects or an array, whose
    // first element is an array of moment objects.
    function pickBy(fn, moments) {
        var res, i;
        if (moments.length === 1 && isArray(moments[0])) {
            moments = moments[0];
        }
        if (!moments.length) {
            return createLocal();
        }
        res = moments[0];
        for (i = 1; i < moments.length; ++i) {
            if (!moments[i].isValid() || moments[i][fn](res)) {
                res = moments[i];
            }
        }
        return res;
    }

    // TODO: Use [].sort instead?
    function min () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isBefore', args);
    }

    function max () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isAfter', args);
    }

    var now = function () {
        return Date.now ? Date.now() : +(new Date());
    };

    var ordering = ['year', 'quarter', 'month', 'week', 'day', 'hour', 'minute', 'second', 'millisecond'];

    function isDurationValid(m) {
        for (var key in m) {
            if (!(indexOf.call(ordering, key) !== -1 && (m[key] == null || !isNaN(m[key])))) {
                return false;
            }
        }

        var unitHasDecimal = false;
        for (var i = 0; i < ordering.length; ++i) {
            if (m[ordering[i]]) {
                if (unitHasDecimal) {
                    return false; // only allow non-integers for smallest unit
                }
                if (parseFloat(m[ordering[i]]) !== toInt(m[ordering[i]])) {
                    unitHasDecimal = true;
                }
            }
        }

        return true;
    }

    function isValid$1() {
        return this._isValid;
    }

    function createInvalid$1() {
        return createDuration(NaN);
    }

    function Duration (duration) {
        var normalizedInput = normalizeObjectUnits(duration),
            years = normalizedInput.year || 0,
            quarters = normalizedInput.quarter || 0,
            months = normalizedInput.month || 0,
            weeks = normalizedInput.week || normalizedInput.isoWeek || 0,
            days = normalizedInput.day || 0,
            hours = normalizedInput.hour || 0,
            minutes = normalizedInput.minute || 0,
            seconds = normalizedInput.second || 0,
            milliseconds = normalizedInput.millisecond || 0;

        this._isValid = isDurationValid(normalizedInput);

        // representation for dateAddRemove
        this._milliseconds = +milliseconds +
            seconds * 1e3 + // 1000
            minutes * 6e4 + // 1000 * 60
            hours * 1000 * 60 * 60; //using 1000 * 60 * 60 instead of 36e5 to avoid floating point rounding errors https://github.com/moment/moment/issues/2978
        // Because of dateAddRemove treats 24 hours as different from a
        // day when working around DST, we need to store them separately
        this._days = +days +
            weeks * 7;
        // It is impossible to translate months into days without knowing
        // which months you are are talking about, so we have to store
        // it separately.
        this._months = +months +
            quarters * 3 +
            years * 12;

        this._data = {};

        this._locale = getLocale();

        this._bubble();
    }

    function isDuration (obj) {
        return obj instanceof Duration;
    }

    function absRound (number) {
        if (number < 0) {
            return Math.round(-1 * number) * -1;
        } else {
            return Math.round(number);
        }
    }

    // FORMATTING

    function offset (token, separator) {
        addFormatToken(token, 0, 0, function () {
            var offset = this.utcOffset();
            var sign = '+';
            if (offset < 0) {
                offset = -offset;
                sign = '-';
            }
            return sign + zeroFill(~~(offset / 60), 2) + separator + zeroFill(~~(offset) % 60, 2);
        });
    }

    offset('Z', ':');
    offset('ZZ', '');

    // PARSING

    addRegexToken('Z',  matchShortOffset);
    addRegexToken('ZZ', matchShortOffset);
    addParseToken(['Z', 'ZZ'], function (input, array, config) {
        config._useUTC = true;
        config._tzm = offsetFromString(matchShortOffset, input);
    });

    // HELPERS

    // timezone chunker
    // '+10:00' > ['10',  '00']
    // '-1530'  > ['-15', '30']
    var chunkOffset = /([\+\-]|\d\d)/gi;

    function offsetFromString(matcher, string) {
        var matches = (string || '').match(matcher);

        if (matches === null) {
            return null;
        }

        var chunk   = matches[matches.length - 1] || [];
        var parts   = (chunk + '').match(chunkOffset) || ['-', 0, 0];
        var minutes = +(parts[1] * 60) + toInt(parts[2]);

        return minutes === 0 ?
          0 :
          parts[0] === '+' ? minutes : -minutes;
    }

    // Return a moment from input, that is local/utc/zone equivalent to model.
    function cloneWithOffset(input, model) {
        var res, diff;
        if (model._isUTC) {
            res = model.clone();
            diff = (isMoment(input) || isDate(input) ? input.valueOf() : createLocal(input).valueOf()) - res.valueOf();
            // Use low-level api, because this fn is low-level api.
            res._d.setTime(res._d.valueOf() + diff);
            hooks.updateOffset(res, false);
            return res;
        } else {
            return createLocal(input).local();
        }
    }

    function getDateOffset (m) {
        // On Firefox.24 Date#getTimezoneOffset returns a floating point.
        // https://github.com/moment/moment/pull/1871
        return -Math.round(m._d.getTimezoneOffset() / 15) * 15;
    }

    // HOOKS

    // This function will be called whenever a moment is mutated.
    // It is intended to keep the offset in sync with the timezone.
    hooks.updateOffset = function () {};

    // MOMENTS

    // keepLocalTime = true means only change the timezone, without
    // affecting the local hour. So 5:31:26 +0300 --[utcOffset(2, true)]-->
    // 5:31:26 +0200 It is possible that 5:31:26 doesn't exist with offset
    // +0200, so we adjust the time as needed, to be valid.
    //
    // Keeping the time actually adds/subtracts (one hour)
    // from the actual represented time. That is why we call updateOffset
    // a second time. In case it wants us to change the offset again
    // _changeInProgress == true case, then we have to adjust, because
    // there is no such time in the given timezone.
    function getSetOffset (input, keepLocalTime, keepMinutes) {
        var offset = this._offset || 0,
            localAdjust;
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        if (input != null) {
            if (typeof input === 'string') {
                input = offsetFromString(matchShortOffset, input);
                if (input === null) {
                    return this;
                }
            } else if (Math.abs(input) < 16 && !keepMinutes) {
                input = input * 60;
            }
            if (!this._isUTC && keepLocalTime) {
                localAdjust = getDateOffset(this);
            }
            this._offset = input;
            this._isUTC = true;
            if (localAdjust != null) {
                this.add(localAdjust, 'm');
            }
            if (offset !== input) {
                if (!keepLocalTime || this._changeInProgress) {
                    addSubtract(this, createDuration(input - offset, 'm'), 1, false);
                } else if (!this._changeInProgress) {
                    this._changeInProgress = true;
                    hooks.updateOffset(this, true);
                    this._changeInProgress = null;
                }
            }
            return this;
        } else {
            return this._isUTC ? offset : getDateOffset(this);
        }
    }

    function getSetZone (input, keepLocalTime) {
        if (input != null) {
            if (typeof input !== 'string') {
                input = -input;
            }

            this.utcOffset(input, keepLocalTime);

            return this;
        } else {
            return -this.utcOffset();
        }
    }

    function setOffsetToUTC (keepLocalTime) {
        return this.utcOffset(0, keepLocalTime);
    }

    function setOffsetToLocal (keepLocalTime) {
        if (this._isUTC) {
            this.utcOffset(0, keepLocalTime);
            this._isUTC = false;

            if (keepLocalTime) {
                this.subtract(getDateOffset(this), 'm');
            }
        }
        return this;
    }

    function setOffsetToParsedOffset () {
        if (this._tzm != null) {
            this.utcOffset(this._tzm, false, true);
        } else if (typeof this._i === 'string') {
            var tZone = offsetFromString(matchOffset, this._i);
            if (tZone != null) {
                this.utcOffset(tZone);
            }
            else {
                this.utcOffset(0, true);
            }
        }
        return this;
    }

    function hasAlignedHourOffset (input) {
        if (!this.isValid()) {
            return false;
        }
        input = input ? createLocal(input).utcOffset() : 0;

        return (this.utcOffset() - input) % 60 === 0;
    }

    function isDaylightSavingTime () {
        return (
            this.utcOffset() > this.clone().month(0).utcOffset() ||
            this.utcOffset() > this.clone().month(5).utcOffset()
        );
    }

    function isDaylightSavingTimeShifted () {
        if (!isUndefined(this._isDSTShifted)) {
            return this._isDSTShifted;
        }

        var c = {};

        copyConfig(c, this);
        c = prepareConfig(c);

        if (c._a) {
            var other = c._isUTC ? createUTC(c._a) : createLocal(c._a);
            this._isDSTShifted = this.isValid() &&
                compareArrays(c._a, other.toArray()) > 0;
        } else {
            this._isDSTShifted = false;
        }

        return this._isDSTShifted;
    }

    function isLocal () {
        return this.isValid() ? !this._isUTC : false;
    }

    function isUtcOffset () {
        return this.isValid() ? this._isUTC : false;
    }

    function isUtc () {
        return this.isValid() ? this._isUTC && this._offset === 0 : false;
    }

    // ASP.NET json date format regex
    var aspNetRegex = /^(\-|\+)?(?:(\d*)[. ])?(\d+)\:(\d+)(?:\:(\d+)(\.\d*)?)?$/;

    // from http://docs.closure-library.googlecode.com/git/closure_goog_date_date.js.source.html
    // somewhat more in line with 4.4.3.2 2004 spec, but allows decimal anywhere
    // and further modified to allow for strings containing both week and day
    var isoRegex = /^(-|\+)?P(?:([-+]?[0-9,.]*)Y)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)W)?(?:([-+]?[0-9,.]*)D)?(?:T(?:([-+]?[0-9,.]*)H)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)S)?)?$/;

    function createDuration (input, key) {
        var duration = input,
            // matching against regexp is expensive, do it on demand
            match = null,
            sign,
            ret,
            diffRes;

        if (isDuration(input)) {
            duration = {
                ms : input._milliseconds,
                d  : input._days,
                M  : input._months
            };
        } else if (isNumber(input)) {
            duration = {};
            if (key) {
                duration[key] = input;
            } else {
                duration.milliseconds = input;
            }
        } else if (!!(match = aspNetRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y  : 0,
                d  : toInt(match[DATE])                         * sign,
                h  : toInt(match[HOUR])                         * sign,
                m  : toInt(match[MINUTE])                       * sign,
                s  : toInt(match[SECOND])                       * sign,
                ms : toInt(absRound(match[MILLISECOND] * 1000)) * sign // the millisecond decimal point is included in the match
            };
        } else if (!!(match = isoRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y : parseIso(match[2], sign),
                M : parseIso(match[3], sign),
                w : parseIso(match[4], sign),
                d : parseIso(match[5], sign),
                h : parseIso(match[6], sign),
                m : parseIso(match[7], sign),
                s : parseIso(match[8], sign)
            };
        } else if (duration == null) {// checks for null or undefined
            duration = {};
        } else if (typeof duration === 'object' && ('from' in duration || 'to' in duration)) {
            diffRes = momentsDifference(createLocal(duration.from), createLocal(duration.to));

            duration = {};
            duration.ms = diffRes.milliseconds;
            duration.M = diffRes.months;
        }

        ret = new Duration(duration);

        if (isDuration(input) && hasOwnProp(input, '_locale')) {
            ret._locale = input._locale;
        }

        return ret;
    }

    createDuration.fn = Duration.prototype;
    createDuration.invalid = createInvalid$1;

    function parseIso (inp, sign) {
        // We'd normally use ~~inp for this, but unfortunately it also
        // converts floats to ints.
        // inp may be undefined, so careful calling replace on it.
        var res = inp && parseFloat(inp.replace(',', '.'));
        // apply sign while we're at it
        return (isNaN(res) ? 0 : res) * sign;
    }

    function positiveMomentsDifference(base, other) {
        var res = {};

        res.months = other.month() - base.month() +
            (other.year() - base.year()) * 12;
        if (base.clone().add(res.months, 'M').isAfter(other)) {
            --res.months;
        }

        res.milliseconds = +other - +(base.clone().add(res.months, 'M'));

        return res;
    }

    function momentsDifference(base, other) {
        var res;
        if (!(base.isValid() && other.isValid())) {
            return {milliseconds: 0, months: 0};
        }

        other = cloneWithOffset(other, base);
        if (base.isBefore(other)) {
            res = positiveMomentsDifference(base, other);
        } else {
            res = positiveMomentsDifference(other, base);
            res.milliseconds = -res.milliseconds;
            res.months = -res.months;
        }

        return res;
    }

    // TODO: remove 'name' arg after deprecation is removed
    function createAdder(direction, name) {
        return function (val, period) {
            var dur, tmp;
            //invert the arguments, but complain about it
            if (period !== null && !isNaN(+period)) {
                deprecateSimple(name, 'moment().' + name  + '(period, number) is deprecated. Please use moment().' + name + '(number, period). ' +
                'See http://momentjs.com/guides/#/warnings/add-inverted-param/ for more info.');
                tmp = val; val = period; period = tmp;
            }

            val = typeof val === 'string' ? +val : val;
            dur = createDuration(val, period);
            addSubtract(this, dur, direction);
            return this;
        };
    }

    function addSubtract (mom, duration, isAdding, updateOffset) {
        var milliseconds = duration._milliseconds,
            days = absRound(duration._days),
            months = absRound(duration._months);

        if (!mom.isValid()) {
            // No op
            return;
        }

        updateOffset = updateOffset == null ? true : updateOffset;

        if (months) {
            setMonth(mom, get(mom, 'Month') + months * isAdding);
        }
        if (days) {
            set$1(mom, 'Date', get(mom, 'Date') + days * isAdding);
        }
        if (milliseconds) {
            mom._d.setTime(mom._d.valueOf() + milliseconds * isAdding);
        }
        if (updateOffset) {
            hooks.updateOffset(mom, days || months);
        }
    }

    var add      = createAdder(1, 'add');
    var subtract = createAdder(-1, 'subtract');

    function getCalendarFormat(myMoment, now) {
        var diff = myMoment.diff(now, 'days', true);
        return diff < -6 ? 'sameElse' :
                diff < -1 ? 'lastWeek' :
                diff < 0 ? 'lastDay' :
                diff < 1 ? 'sameDay' :
                diff < 2 ? 'nextDay' :
                diff < 7 ? 'nextWeek' : 'sameElse';
    }

    function calendar$1 (time, formats) {
        // We want to compare the start of today, vs this.
        // Getting start-of-today depends on whether we're local/utc/offset or not.
        var now = time || createLocal(),
            sod = cloneWithOffset(now, this).startOf('day'),
            format = hooks.calendarFormat(this, sod) || 'sameElse';

        var output = formats && (isFunction(formats[format]) ? formats[format].call(this, now) : formats[format]);

        return this.format(output || this.localeData().calendar(format, this, createLocal(now)));
    }

    function clone () {
        return new Moment(this);
    }

    function isAfter (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input);
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() > localInput.valueOf();
        } else {
            return localInput.valueOf() < this.clone().startOf(units).valueOf();
        }
    }

    function isBefore (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input);
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() < localInput.valueOf();
        } else {
            return this.clone().endOf(units).valueOf() < localInput.valueOf();
        }
    }

    function isBetween (from, to, units, inclusivity) {
        var localFrom = isMoment(from) ? from : createLocal(from),
            localTo = isMoment(to) ? to : createLocal(to);
        if (!(this.isValid() && localFrom.isValid() && localTo.isValid())) {
            return false;
        }
        inclusivity = inclusivity || '()';
        return (inclusivity[0] === '(' ? this.isAfter(localFrom, units) : !this.isBefore(localFrom, units)) &&
            (inclusivity[1] === ')' ? this.isBefore(localTo, units) : !this.isAfter(localTo, units));
    }

    function isSame (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input),
            inputMs;
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() === localInput.valueOf();
        } else {
            inputMs = localInput.valueOf();
            return this.clone().startOf(units).valueOf() <= inputMs && inputMs <= this.clone().endOf(units).valueOf();
        }
    }

    function isSameOrAfter (input, units) {
        return this.isSame(input, units) || this.isAfter(input, units);
    }

    function isSameOrBefore (input, units) {
        return this.isSame(input, units) || this.isBefore(input, units);
    }

    function diff (input, units, asFloat) {
        var that,
            zoneDelta,
            output;

        if (!this.isValid()) {
            return NaN;
        }

        that = cloneWithOffset(input, this);

        if (!that.isValid()) {
            return NaN;
        }

        zoneDelta = (that.utcOffset() - this.utcOffset()) * 6e4;

        units = normalizeUnits(units);

        switch (units) {
            case 'year': output = monthDiff(this, that) / 12; break;
            case 'month': output = monthDiff(this, that); break;
            case 'quarter': output = monthDiff(this, that) / 3; break;
            case 'second': output = (this - that) / 1e3; break; // 1000
            case 'minute': output = (this - that) / 6e4; break; // 1000 * 60
            case 'hour': output = (this - that) / 36e5; break; // 1000 * 60 * 60
            case 'day': output = (this - that - zoneDelta) / 864e5; break; // 1000 * 60 * 60 * 24, negate dst
            case 'week': output = (this - that - zoneDelta) / 6048e5; break; // 1000 * 60 * 60 * 24 * 7, negate dst
            default: output = this - that;
        }

        return asFloat ? output : absFloor(output);
    }

    function monthDiff (a, b) {
        // difference in months
        var wholeMonthDiff = ((b.year() - a.year()) * 12) + (b.month() - a.month()),
            // b is in (anchor - 1 month, anchor + 1 month)
            anchor = a.clone().add(wholeMonthDiff, 'months'),
            anchor2, adjust;

        if (b - anchor < 0) {
            anchor2 = a.clone().add(wholeMonthDiff - 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor - anchor2);
        } else {
            anchor2 = a.clone().add(wholeMonthDiff + 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor2 - anchor);
        }

        //check for negative zero, return zero if negative zero
        return -(wholeMonthDiff + adjust) || 0;
    }

    hooks.defaultFormat = 'YYYY-MM-DDTHH:mm:ssZ';
    hooks.defaultFormatUtc = 'YYYY-MM-DDTHH:mm:ss[Z]';

    function toString () {
        return this.clone().locale('en').format('ddd MMM DD YYYY HH:mm:ss [GMT]ZZ');
    }

    function toISOString(keepOffset) {
        if (!this.isValid()) {
            return null;
        }
        var utc = keepOffset !== true;
        var m = utc ? this.clone().utc() : this;
        if (m.year() < 0 || m.year() > 9999) {
            return formatMoment(m, utc ? 'YYYYYY-MM-DD[T]HH:mm:ss.SSS[Z]' : 'YYYYYY-MM-DD[T]HH:mm:ss.SSSZ');
        }
        if (isFunction(Date.prototype.toISOString)) {
            // native implementation is ~50x faster, use it when we can
            if (utc) {
                return this.toDate().toISOString();
            } else {
                return new Date(this.valueOf() + this.utcOffset() * 60 * 1000).toISOString().replace('Z', formatMoment(m, 'Z'));
            }
        }
        return formatMoment(m, utc ? 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]' : 'YYYY-MM-DD[T]HH:mm:ss.SSSZ');
    }

    /**
     * Return a human readable representation of a moment that can
     * also be evaluated to get a new moment which is the same
     *
     * @link https://nodejs.org/dist/latest/docs/api/util.html#util_custom_inspect_function_on_objects
     */
    function inspect () {
        if (!this.isValid()) {
            return 'moment.invalid(/* ' + this._i + ' */)';
        }
        var func = 'moment';
        var zone = '';
        if (!this.isLocal()) {
            func = this.utcOffset() === 0 ? 'moment.utc' : 'moment.parseZone';
            zone = 'Z';
        }
        var prefix = '[' + func + '("]';
        var year = (0 <= this.year() && this.year() <= 9999) ? 'YYYY' : 'YYYYYY';
        var datetime = '-MM-DD[T]HH:mm:ss.SSS';
        var suffix = zone + '[")]';

        return this.format(prefix + year + datetime + suffix);
    }

    function format (inputString) {
        if (!inputString) {
            inputString = this.isUtc() ? hooks.defaultFormatUtc : hooks.defaultFormat;
        }
        var output = formatMoment(this, inputString);
        return this.localeData().postformat(output);
    }

    function from (time, withoutSuffix) {
        if (this.isValid() &&
                ((isMoment(time) && time.isValid()) ||
                 createLocal(time).isValid())) {
            return createDuration({to: this, from: time}).locale(this.locale()).humanize(!withoutSuffix);
        } else {
            return this.localeData().invalidDate();
        }
    }

    function fromNow (withoutSuffix) {
        return this.from(createLocal(), withoutSuffix);
    }

    function to (time, withoutSuffix) {
        if (this.isValid() &&
                ((isMoment(time) && time.isValid()) ||
                 createLocal(time).isValid())) {
            return createDuration({from: this, to: time}).locale(this.locale()).humanize(!withoutSuffix);
        } else {
            return this.localeData().invalidDate();
        }
    }

    function toNow (withoutSuffix) {
        return this.to(createLocal(), withoutSuffix);
    }

    // If passed a locale key, it will set the locale for this
    // instance.  Otherwise, it will return the locale configuration
    // variables for this instance.
    function locale (key) {
        var newLocaleData;

        if (key === undefined) {
            return this._locale._abbr;
        } else {
            newLocaleData = getLocale(key);
            if (newLocaleData != null) {
                this._locale = newLocaleData;
            }
            return this;
        }
    }

    var lang = deprecate(
        'moment().lang() is deprecated. Instead, use moment().localeData() to get the language configuration. Use moment().locale() to change languages.',
        function (key) {
            if (key === undefined) {
                return this.localeData();
            } else {
                return this.locale(key);
            }
        }
    );

    function localeData () {
        return this._locale;
    }

    var MS_PER_SECOND = 1000;
    var MS_PER_MINUTE = 60 * MS_PER_SECOND;
    var MS_PER_HOUR = 60 * MS_PER_MINUTE;
    var MS_PER_400_YEARS = (365 * 400 + 97) * 24 * MS_PER_HOUR;

    // actual modulo - handles negative numbers (for dates before 1970):
    function mod$1(dividend, divisor) {
        return (dividend % divisor + divisor) % divisor;
    }

    function localStartOfDate(y, m, d) {
        // the date constructor remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            return new Date(y + 400, m, d) - MS_PER_400_YEARS;
        } else {
            return new Date(y, m, d).valueOf();
        }
    }

    function utcStartOfDate(y, m, d) {
        // Date.UTC remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            return Date.UTC(y + 400, m, d) - MS_PER_400_YEARS;
        } else {
            return Date.UTC(y, m, d);
        }
    }

    function startOf (units) {
        var time;
        units = normalizeUnits(units);
        if (units === undefined || units === 'millisecond' || !this.isValid()) {
            return this;
        }

        var startOfDate = this._isUTC ? utcStartOfDate : localStartOfDate;

        switch (units) {
            case 'year':
                time = startOfDate(this.year(), 0, 1);
                break;
            case 'quarter':
                time = startOfDate(this.year(), this.month() - this.month() % 3, 1);
                break;
            case 'month':
                time = startOfDate(this.year(), this.month(), 1);
                break;
            case 'week':
                time = startOfDate(this.year(), this.month(), this.date() - this.weekday());
                break;
            case 'isoWeek':
                time = startOfDate(this.year(), this.month(), this.date() - (this.isoWeekday() - 1));
                break;
            case 'day':
            case 'date':
                time = startOfDate(this.year(), this.month(), this.date());
                break;
            case 'hour':
                time = this._d.valueOf();
                time -= mod$1(time + (this._isUTC ? 0 : this.utcOffset() * MS_PER_MINUTE), MS_PER_HOUR);
                break;
            case 'minute':
                time = this._d.valueOf();
                time -= mod$1(time, MS_PER_MINUTE);
                break;
            case 'second':
                time = this._d.valueOf();
                time -= mod$1(time, MS_PER_SECOND);
                break;
        }

        this._d.setTime(time);
        hooks.updateOffset(this, true);
        return this;
    }

    function endOf (units) {
        var time;
        units = normalizeUnits(units);
        if (units === undefined || units === 'millisecond' || !this.isValid()) {
            return this;
        }

        var startOfDate = this._isUTC ? utcStartOfDate : localStartOfDate;

        switch (units) {
            case 'year':
                time = startOfDate(this.year() + 1, 0, 1) - 1;
                break;
            case 'quarter':
                time = startOfDate(this.year(), this.month() - this.month() % 3 + 3, 1) - 1;
                break;
            case 'month':
                time = startOfDate(this.year(), this.month() + 1, 1) - 1;
                break;
            case 'week':
                time = startOfDate(this.year(), this.month(), this.date() - this.weekday() + 7) - 1;
                break;
            case 'isoWeek':
                time = startOfDate(this.year(), this.month(), this.date() - (this.isoWeekday() - 1) + 7) - 1;
                break;
            case 'day':
            case 'date':
                time = startOfDate(this.year(), this.month(), this.date() + 1) - 1;
                break;
            case 'hour':
                time = this._d.valueOf();
                time += MS_PER_HOUR - mod$1(time + (this._isUTC ? 0 : this.utcOffset() * MS_PER_MINUTE), MS_PER_HOUR) - 1;
                break;
            case 'minute':
                time = this._d.valueOf();
                time += MS_PER_MINUTE - mod$1(time, MS_PER_MINUTE) - 1;
                break;
            case 'second':
                time = this._d.valueOf();
                time += MS_PER_SECOND - mod$1(time, MS_PER_SECOND) - 1;
                break;
        }

        this._d.setTime(time);
        hooks.updateOffset(this, true);
        return this;
    }

    function valueOf () {
        return this._d.valueOf() - ((this._offset || 0) * 60000);
    }

    function unix () {
        return Math.floor(this.valueOf() / 1000);
    }

    function toDate () {
        return new Date(this.valueOf());
    }

    function toArray () {
        var m = this;
        return [m.year(), m.month(), m.date(), m.hour(), m.minute(), m.second(), m.millisecond()];
    }

    function toObject () {
        var m = this;
        return {
            years: m.year(),
            months: m.month(),
            date: m.date(),
            hours: m.hours(),
            minutes: m.minutes(),
            seconds: m.seconds(),
            milliseconds: m.milliseconds()
        };
    }

    function toJSON () {
        // new Date(NaN).toJSON() === null
        return this.isValid() ? this.toISOString() : null;
    }

    function isValid$2 () {
        return isValid(this);
    }

    function parsingFlags () {
        return extend({}, getParsingFlags(this));
    }

    function invalidAt () {
        return getParsingFlags(this).overflow;
    }

    function creationData() {
        return {
            input: this._i,
            format: this._f,
            locale: this._locale,
            isUTC: this._isUTC,
            strict: this._strict
        };
    }

    // FORMATTING

    addFormatToken(0, ['gg', 2], 0, function () {
        return this.weekYear() % 100;
    });

    addFormatToken(0, ['GG', 2], 0, function () {
        return this.isoWeekYear() % 100;
    });

    function addWeekYearFormatToken (token, getter) {
        addFormatToken(0, [token, token.length], 0, getter);
    }

    addWeekYearFormatToken('gggg',     'weekYear');
    addWeekYearFormatToken('ggggg',    'weekYear');
    addWeekYearFormatToken('GGGG',  'isoWeekYear');
    addWeekYearFormatToken('GGGGG', 'isoWeekYear');

    // ALIASES

    addUnitAlias('weekYear', 'gg');
    addUnitAlias('isoWeekYear', 'GG');

    // PRIORITY

    addUnitPriority('weekYear', 1);
    addUnitPriority('isoWeekYear', 1);


    // PARSING

    addRegexToken('G',      matchSigned);
    addRegexToken('g',      matchSigned);
    addRegexToken('GG',     match1to2, match2);
    addRegexToken('gg',     match1to2, match2);
    addRegexToken('GGGG',   match1to4, match4);
    addRegexToken('gggg',   match1to4, match4);
    addRegexToken('GGGGG',  match1to6, match6);
    addRegexToken('ggggg',  match1to6, match6);

    addWeekParseToken(['gggg', 'ggggg', 'GGGG', 'GGGGG'], function (input, week, config, token) {
        week[token.substr(0, 2)] = toInt(input);
    });

    addWeekParseToken(['gg', 'GG'], function (input, week, config, token) {
        week[token] = hooks.parseTwoDigitYear(input);
    });

    // MOMENTS

    function getSetWeekYear (input) {
        return getSetWeekYearHelper.call(this,
                input,
                this.week(),
                this.weekday(),
                this.localeData()._week.dow,
                this.localeData()._week.doy);
    }

    function getSetISOWeekYear (input) {
        return getSetWeekYearHelper.call(this,
                input, this.isoWeek(), this.isoWeekday(), 1, 4);
    }

    function getISOWeeksInYear () {
        return weeksInYear(this.year(), 1, 4);
    }

    function getWeeksInYear () {
        var weekInfo = this.localeData()._week;
        return weeksInYear(this.year(), weekInfo.dow, weekInfo.doy);
    }

    function getSetWeekYearHelper(input, week, weekday, dow, doy) {
        var weeksTarget;
        if (input == null) {
            return weekOfYear(this, dow, doy).year;
        } else {
            weeksTarget = weeksInYear(input, dow, doy);
            if (week > weeksTarget) {
                week = weeksTarget;
            }
            return setWeekAll.call(this, input, week, weekday, dow, doy);
        }
    }

    function setWeekAll(weekYear, week, weekday, dow, doy) {
        var dayOfYearData = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy),
            date = createUTCDate(dayOfYearData.year, 0, dayOfYearData.dayOfYear);

        this.year(date.getUTCFullYear());
        this.month(date.getUTCMonth());
        this.date(date.getUTCDate());
        return this;
    }

    // FORMATTING

    addFormatToken('Q', 0, 'Qo', 'quarter');

    // ALIASES

    addUnitAlias('quarter', 'Q');

    // PRIORITY

    addUnitPriority('quarter', 7);

    // PARSING

    addRegexToken('Q', match1);
    addParseToken('Q', function (input, array) {
        array[MONTH] = (toInt(input) - 1) * 3;
    });

    // MOMENTS

    function getSetQuarter (input) {
        return input == null ? Math.ceil((this.month() + 1) / 3) : this.month((input - 1) * 3 + this.month() % 3);
    }

    // FORMATTING

    addFormatToken('D', ['DD', 2], 'Do', 'date');

    // ALIASES

    addUnitAlias('date', 'D');

    // PRIORITY
    addUnitPriority('date', 9);

    // PARSING

    addRegexToken('D',  match1to2);
    addRegexToken('DD', match1to2, match2);
    addRegexToken('Do', function (isStrict, locale) {
        // TODO: Remove "ordinalParse" fallback in next major release.
        return isStrict ?
          (locale._dayOfMonthOrdinalParse || locale._ordinalParse) :
          locale._dayOfMonthOrdinalParseLenient;
    });

    addParseToken(['D', 'DD'], DATE);
    addParseToken('Do', function (input, array) {
        array[DATE] = toInt(input.match(match1to2)[0]);
    });

    // MOMENTS

    var getSetDayOfMonth = makeGetSet('Date', true);

    // FORMATTING

    addFormatToken('DDD', ['DDDD', 3], 'DDDo', 'dayOfYear');

    // ALIASES

    addUnitAlias('dayOfYear', 'DDD');

    // PRIORITY
    addUnitPriority('dayOfYear', 4);

    // PARSING

    addRegexToken('DDD',  match1to3);
    addRegexToken('DDDD', match3);
    addParseToken(['DDD', 'DDDD'], function (input, array, config) {
        config._dayOfYear = toInt(input);
    });

    // HELPERS

    // MOMENTS

    function getSetDayOfYear (input) {
        var dayOfYear = Math.round((this.clone().startOf('day') - this.clone().startOf('year')) / 864e5) + 1;
        return input == null ? dayOfYear : this.add((input - dayOfYear), 'd');
    }

    // FORMATTING

    addFormatToken('m', ['mm', 2], 0, 'minute');

    // ALIASES

    addUnitAlias('minute', 'm');

    // PRIORITY

    addUnitPriority('minute', 14);

    // PARSING

    addRegexToken('m',  match1to2);
    addRegexToken('mm', match1to2, match2);
    addParseToken(['m', 'mm'], MINUTE);

    // MOMENTS

    var getSetMinute = makeGetSet('Minutes', false);

    // FORMATTING

    addFormatToken('s', ['ss', 2], 0, 'second');

    // ALIASES

    addUnitAlias('second', 's');

    // PRIORITY

    addUnitPriority('second', 15);

    // PARSING

    addRegexToken('s',  match1to2);
    addRegexToken('ss', match1to2, match2);
    addParseToken(['s', 'ss'], SECOND);

    // MOMENTS

    var getSetSecond = makeGetSet('Seconds', false);

    // FORMATTING

    addFormatToken('S', 0, 0, function () {
        return ~~(this.millisecond() / 100);
    });

    addFormatToken(0, ['SS', 2], 0, function () {
        return ~~(this.millisecond() / 10);
    });

    addFormatToken(0, ['SSS', 3], 0, 'millisecond');
    addFormatToken(0, ['SSSS', 4], 0, function () {
        return this.millisecond() * 10;
    });
    addFormatToken(0, ['SSSSS', 5], 0, function () {
        return this.millisecond() * 100;
    });
    addFormatToken(0, ['SSSSSS', 6], 0, function () {
        return this.millisecond() * 1000;
    });
    addFormatToken(0, ['SSSSSSS', 7], 0, function () {
        return this.millisecond() * 10000;
    });
    addFormatToken(0, ['SSSSSSSS', 8], 0, function () {
        return this.millisecond() * 100000;
    });
    addFormatToken(0, ['SSSSSSSSS', 9], 0, function () {
        return this.millisecond() * 1000000;
    });


    // ALIASES

    addUnitAlias('millisecond', 'ms');

    // PRIORITY

    addUnitPriority('millisecond', 16);

    // PARSING

    addRegexToken('S',    match1to3, match1);
    addRegexToken('SS',   match1to3, match2);
    addRegexToken('SSS',  match1to3, match3);

    var token;
    for (token = 'SSSS'; token.length <= 9; token += 'S') {
        addRegexToken(token, matchUnsigned);
    }

    function parseMs(input, array) {
        array[MILLISECOND] = toInt(('0.' + input) * 1000);
    }

    for (token = 'S'; token.length <= 9; token += 'S') {
        addParseToken(token, parseMs);
    }
    // MOMENTS

    var getSetMillisecond = makeGetSet('Milliseconds', false);

    // FORMATTING

    addFormatToken('z',  0, 0, 'zoneAbbr');
    addFormatToken('zz', 0, 0, 'zoneName');

    // MOMENTS

    function getZoneAbbr () {
        return this._isUTC ? 'UTC' : '';
    }

    function getZoneName () {
        return this._isUTC ? 'Coordinated Universal Time' : '';
    }

    var proto = Moment.prototype;

    proto.add               = add;
    proto.calendar          = calendar$1;
    proto.clone             = clone;
    proto.diff              = diff;
    proto.endOf             = endOf;
    proto.format            = format;
    proto.from              = from;
    proto.fromNow           = fromNow;
    proto.to                = to;
    proto.toNow             = toNow;
    proto.get               = stringGet;
    proto.invalidAt         = invalidAt;
    proto.isAfter           = isAfter;
    proto.isBefore          = isBefore;
    proto.isBetween         = isBetween;
    proto.isSame            = isSame;
    proto.isSameOrAfter     = isSameOrAfter;
    proto.isSameOrBefore    = isSameOrBefore;
    proto.isValid           = isValid$2;
    proto.lang              = lang;
    proto.locale            = locale;
    proto.localeData        = localeData;
    proto.max               = prototypeMax;
    proto.min               = prototypeMin;
    proto.parsingFlags      = parsingFlags;
    proto.set               = stringSet;
    proto.startOf           = startOf;
    proto.subtract          = subtract;
    proto.toArray           = toArray;
    proto.toObject          = toObject;
    proto.toDate            = toDate;
    proto.toISOString       = toISOString;
    proto.inspect           = inspect;
    proto.toJSON            = toJSON;
    proto.toString          = toString;
    proto.unix              = unix;
    proto.valueOf           = valueOf;
    proto.creationData      = creationData;
    proto.year       = getSetYear;
    proto.isLeapYear = getIsLeapYear;
    proto.weekYear    = getSetWeekYear;
    proto.isoWeekYear = getSetISOWeekYear;
    proto.quarter = proto.quarters = getSetQuarter;
    proto.month       = getSetMonth;
    proto.daysInMonth = getDaysInMonth;
    proto.week           = proto.weeks        = getSetWeek;
    proto.isoWeek        = proto.isoWeeks     = getSetISOWeek;
    proto.weeksInYear    = getWeeksInYear;
    proto.isoWeeksInYear = getISOWeeksInYear;
    proto.date       = getSetDayOfMonth;
    proto.day        = proto.days             = getSetDayOfWeek;
    proto.weekday    = getSetLocaleDayOfWeek;
    proto.isoWeekday = getSetISODayOfWeek;
    proto.dayOfYear  = getSetDayOfYear;
    proto.hour = proto.hours = getSetHour;
    proto.minute = proto.minutes = getSetMinute;
    proto.second = proto.seconds = getSetSecond;
    proto.millisecond = proto.milliseconds = getSetMillisecond;
    proto.utcOffset            = getSetOffset;
    proto.utc                  = setOffsetToUTC;
    proto.local                = setOffsetToLocal;
    proto.parseZone            = setOffsetToParsedOffset;
    proto.hasAlignedHourOffset = hasAlignedHourOffset;
    proto.isDST                = isDaylightSavingTime;
    proto.isLocal              = isLocal;
    proto.isUtcOffset          = isUtcOffset;
    proto.isUtc                = isUtc;
    proto.isUTC                = isUtc;
    proto.zoneAbbr = getZoneAbbr;
    proto.zoneName = getZoneName;
    proto.dates  = deprecate('dates accessor is deprecated. Use date instead.', getSetDayOfMonth);
    proto.months = deprecate('months accessor is deprecated. Use month instead', getSetMonth);
    proto.years  = deprecate('years accessor is deprecated. Use year instead', getSetYear);
    proto.zone   = deprecate('moment().zone is deprecated, use moment().utcOffset instead. http://momentjs.com/guides/#/warnings/zone/', getSetZone);
    proto.isDSTShifted = deprecate('isDSTShifted is deprecated. See http://momentjs.com/guides/#/warnings/dst-shifted/ for more information', isDaylightSavingTimeShifted);

    function createUnix (input) {
        return createLocal(input * 1000);
    }

    function createInZone () {
        return createLocal.apply(null, arguments).parseZone();
    }

    function preParsePostFormat (string) {
        return string;
    }

    var proto$1 = Locale.prototype;

    proto$1.calendar        = calendar;
    proto$1.longDateFormat  = longDateFormat;
    proto$1.invalidDate     = invalidDate;
    proto$1.ordinal         = ordinal;
    proto$1.preparse        = preParsePostFormat;
    proto$1.postformat      = preParsePostFormat;
    proto$1.relativeTime    = relativeTime;
    proto$1.pastFuture      = pastFuture;
    proto$1.set             = set;

    proto$1.months            =        localeMonths;
    proto$1.monthsShort       =        localeMonthsShort;
    proto$1.monthsParse       =        localeMonthsParse;
    proto$1.monthsRegex       = monthsRegex;
    proto$1.monthsShortRegex  = monthsShortRegex;
    proto$1.week = localeWeek;
    proto$1.firstDayOfYear = localeFirstDayOfYear;
    proto$1.firstDayOfWeek = localeFirstDayOfWeek;

    proto$1.weekdays       =        localeWeekdays;
    proto$1.weekdaysMin    =        localeWeekdaysMin;
    proto$1.weekdaysShort  =        localeWeekdaysShort;
    proto$1.weekdaysParse  =        localeWeekdaysParse;

    proto$1.weekdaysRegex       =        weekdaysRegex;
    proto$1.weekdaysShortRegex  =        weekdaysShortRegex;
    proto$1.weekdaysMinRegex    =        weekdaysMinRegex;

    proto$1.isPM = localeIsPM;
    proto$1.meridiem = localeMeridiem;

    function get$1 (format, index, field, setter) {
        var locale = getLocale();
        var utc = createUTC().set(setter, index);
        return locale[field](utc, format);
    }

    function listMonthsImpl (format, index, field) {
        if (isNumber(format)) {
            index = format;
            format = undefined;
        }

        format = format || '';

        if (index != null) {
            return get$1(format, index, field, 'month');
        }

        var i;
        var out = [];
        for (i = 0; i < 12; i++) {
            out[i] = get$1(format, i, field, 'month');
        }
        return out;
    }

    // ()
    // (5)
    // (fmt, 5)
    // (fmt)
    // (true)
    // (true, 5)
    // (true, fmt, 5)
    // (true, fmt)
    function listWeekdaysImpl (localeSorted, format, index, field) {
        if (typeof localeSorted === 'boolean') {
            if (isNumber(format)) {
                index = format;
                format = undefined;
            }

            format = format || '';
        } else {
            format = localeSorted;
            index = format;
            localeSorted = false;

            if (isNumber(format)) {
                index = format;
                format = undefined;
            }

            format = format || '';
        }

        var locale = getLocale(),
            shift = localeSorted ? locale._week.dow : 0;

        if (index != null) {
            return get$1(format, (index + shift) % 7, field, 'day');
        }

        var i;
        var out = [];
        for (i = 0; i < 7; i++) {
            out[i] = get$1(format, (i + shift) % 7, field, 'day');
        }
        return out;
    }

    function listMonths (format, index) {
        return listMonthsImpl(format, index, 'months');
    }

    function listMonthsShort (format, index) {
        return listMonthsImpl(format, index, 'monthsShort');
    }

    function listWeekdays (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdays');
    }

    function listWeekdaysShort (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdaysShort');
    }

    function listWeekdaysMin (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdaysMin');
    }

    getSetGlobalLocale('en', {
        dayOfMonthOrdinalParse: /\d{1,2}(th|st|nd|rd)/,
        ordinal : function (number) {
            var b = number % 10,
                output = (toInt(number % 100 / 10) === 1) ? 'th' :
                (b === 1) ? 'st' :
                (b === 2) ? 'nd' :
                (b === 3) ? 'rd' : 'th';
            return number + output;
        }
    });

    // Side effect imports

    hooks.lang = deprecate('moment.lang is deprecated. Use moment.locale instead.', getSetGlobalLocale);
    hooks.langData = deprecate('moment.langData is deprecated. Use moment.localeData instead.', getLocale);

    var mathAbs = Math.abs;

    function abs () {
        var data           = this._data;

        this._milliseconds = mathAbs(this._milliseconds);
        this._days         = mathAbs(this._days);
        this._months       = mathAbs(this._months);

        data.milliseconds  = mathAbs(data.milliseconds);
        data.seconds       = mathAbs(data.seconds);
        data.minutes       = mathAbs(data.minutes);
        data.hours         = mathAbs(data.hours);
        data.months        = mathAbs(data.months);
        data.years         = mathAbs(data.years);

        return this;
    }

    function addSubtract$1 (duration, input, value, direction) {
        var other = createDuration(input, value);

        duration._milliseconds += direction * other._milliseconds;
        duration._days         += direction * other._days;
        duration._months       += direction * other._months;

        return duration._bubble();
    }

    // supports only 2.0-style add(1, 's') or add(duration)
    function add$1 (input, value) {
        return addSubtract$1(this, input, value, 1);
    }

    // supports only 2.0-style subtract(1, 's') or subtract(duration)
    function subtract$1 (input, value) {
        return addSubtract$1(this, input, value, -1);
    }

    function absCeil (number) {
        if (number < 0) {
            return Math.floor(number);
        } else {
            return Math.ceil(number);
        }
    }

    function bubble () {
        var milliseconds = this._milliseconds;
        var days         = this._days;
        var months       = this._months;
        var data         = this._data;
        var seconds, minutes, hours, years, monthsFromDays;

        // if we have a mix of positive and negative values, bubble down first
        // check: https://github.com/moment/moment/issues/2166
        if (!((milliseconds >= 0 && days >= 0 && months >= 0) ||
                (milliseconds <= 0 && days <= 0 && months <= 0))) {
            milliseconds += absCeil(monthsToDays(months) + days) * 864e5;
            days = 0;
            months = 0;
        }

        // The following code bubbles up values, see the tests for
        // examples of what that means.
        data.milliseconds = milliseconds % 1000;

        seconds           = absFloor(milliseconds / 1000);
        data.seconds      = seconds % 60;

        minutes           = absFloor(seconds / 60);
        data.minutes      = minutes % 60;

        hours             = absFloor(minutes / 60);
        data.hours        = hours % 24;

        days += absFloor(hours / 24);

        // convert days to months
        monthsFromDays = absFloor(daysToMonths(days));
        months += monthsFromDays;
        days -= absCeil(monthsToDays(monthsFromDays));

        // 12 months -> 1 year
        years = absFloor(months / 12);
        months %= 12;

        data.days   = days;
        data.months = months;
        data.years  = years;

        return this;
    }

    function daysToMonths (days) {
        // 400 years have 146097 days (taking into account leap year rules)
        // 400 years have 12 months === 4800
        return days * 4800 / 146097;
    }

    function monthsToDays (months) {
        // the reverse of daysToMonths
        return months * 146097 / 4800;
    }

    function as (units) {
        if (!this.isValid()) {
            return NaN;
        }
        var days;
        var months;
        var milliseconds = this._milliseconds;

        units = normalizeUnits(units);

        if (units === 'month' || units === 'quarter' || units === 'year') {
            days = this._days + milliseconds / 864e5;
            months = this._months + daysToMonths(days);
            switch (units) {
                case 'month':   return months;
                case 'quarter': return months / 3;
                case 'year':    return months / 12;
            }
        } else {
            // handle milliseconds separately because of floating point math errors (issue #1867)
            days = this._days + Math.round(monthsToDays(this._months));
            switch (units) {
                case 'week'   : return days / 7     + milliseconds / 6048e5;
                case 'day'    : return days         + milliseconds / 864e5;
                case 'hour'   : return days * 24    + milliseconds / 36e5;
                case 'minute' : return days * 1440  + milliseconds / 6e4;
                case 'second' : return days * 86400 + milliseconds / 1000;
                // Math.floor prevents floating point math errors here
                case 'millisecond': return Math.floor(days * 864e5) + milliseconds;
                default: throw new Error('Unknown unit ' + units);
            }
        }
    }

    // TODO: Use this.as('ms')?
    function valueOf$1 () {
        if (!this.isValid()) {
            return NaN;
        }
        return (
            this._milliseconds +
            this._days * 864e5 +
            (this._months % 12) * 2592e6 +
            toInt(this._months / 12) * 31536e6
        );
    }

    function makeAs (alias) {
        return function () {
            return this.as(alias);
        };
    }

    var asMilliseconds = makeAs('ms');
    var asSeconds      = makeAs('s');
    var asMinutes      = makeAs('m');
    var asHours        = makeAs('h');
    var asDays         = makeAs('d');
    var asWeeks        = makeAs('w');
    var asMonths       = makeAs('M');
    var asQuarters     = makeAs('Q');
    var asYears        = makeAs('y');

    function clone$1 () {
        return createDuration(this);
    }

    function get$2 (units) {
        units = normalizeUnits(units);
        return this.isValid() ? this[units + 's']() : NaN;
    }

    function makeGetter(name) {
        return function () {
            return this.isValid() ? this._data[name] : NaN;
        };
    }

    var milliseconds = makeGetter('milliseconds');
    var seconds      = makeGetter('seconds');
    var minutes      = makeGetter('minutes');
    var hours        = makeGetter('hours');
    var days         = makeGetter('days');
    var months       = makeGetter('months');
    var years        = makeGetter('years');

    function weeks () {
        return absFloor(this.days() / 7);
    }

    var round = Math.round;
    var thresholds = {
        ss: 44,         // a few seconds to seconds
        s : 45,         // seconds to minute
        m : 45,         // minutes to hour
        h : 22,         // hours to day
        d : 26,         // days to month
        M : 11          // months to year
    };

    // helper function for moment.fn.from, moment.fn.fromNow, and moment.duration.fn.humanize
    function substituteTimeAgo(string, number, withoutSuffix, isFuture, locale) {
        return locale.relativeTime(number || 1, !!withoutSuffix, string, isFuture);
    }

    function relativeTime$1 (posNegDuration, withoutSuffix, locale) {
        var duration = createDuration(posNegDuration).abs();
        var seconds  = round(duration.as('s'));
        var minutes  = round(duration.as('m'));
        var hours    = round(duration.as('h'));
        var days     = round(duration.as('d'));
        var months   = round(duration.as('M'));
        var years    = round(duration.as('y'));

        var a = seconds <= thresholds.ss && ['s', seconds]  ||
                seconds < thresholds.s   && ['ss', seconds] ||
                minutes <= 1             && ['m']           ||
                minutes < thresholds.m   && ['mm', minutes] ||
                hours   <= 1             && ['h']           ||
                hours   < thresholds.h   && ['hh', hours]   ||
                days    <= 1             && ['d']           ||
                days    < thresholds.d   && ['dd', days]    ||
                months  <= 1             && ['M']           ||
                months  < thresholds.M   && ['MM', months]  ||
                years   <= 1             && ['y']           || ['yy', years];

        a[2] = withoutSuffix;
        a[3] = +posNegDuration > 0;
        a[4] = locale;
        return substituteTimeAgo.apply(null, a);
    }

    // This function allows you to set the rounding function for relative time strings
    function getSetRelativeTimeRounding (roundingFunction) {
        if (roundingFunction === undefined) {
            return round;
        }
        if (typeof(roundingFunction) === 'function') {
            round = roundingFunction;
            return true;
        }
        return false;
    }

    // This function allows you to set a threshold for relative time strings
    function getSetRelativeTimeThreshold (threshold, limit) {
        if (thresholds[threshold] === undefined) {
            return false;
        }
        if (limit === undefined) {
            return thresholds[threshold];
        }
        thresholds[threshold] = limit;
        if (threshold === 's') {
            thresholds.ss = limit - 1;
        }
        return true;
    }

    function humanize (withSuffix) {
        if (!this.isValid()) {
            return this.localeData().invalidDate();
        }

        var locale = this.localeData();
        var output = relativeTime$1(this, !withSuffix, locale);

        if (withSuffix) {
            output = locale.pastFuture(+this, output);
        }

        return locale.postformat(output);
    }

    var abs$1 = Math.abs;

    function sign(x) {
        return ((x > 0) - (x < 0)) || +x;
    }

    function toISOString$1() {
        // for ISO strings we do not use the normal bubbling rules:
        //  * milliseconds bubble up until they become hours
        //  * days do not bubble at all
        //  * months bubble up until they become years
        // This is because there is no context-free conversion between hours and days
        // (think of clock changes)
        // and also not between days and months (28-31 days per month)
        if (!this.isValid()) {
            return this.localeData().invalidDate();
        }

        var seconds = abs$1(this._milliseconds) / 1000;
        var days         = abs$1(this._days);
        var months       = abs$1(this._months);
        var minutes, hours, years;

        // 3600 seconds -> 60 minutes -> 1 hour
        minutes           = absFloor(seconds / 60);
        hours             = absFloor(minutes / 60);
        seconds %= 60;
        minutes %= 60;

        // 12 months -> 1 year
        years  = absFloor(months / 12);
        months %= 12;


        // inspired by https://github.com/dordille/moment-isoduration/blob/master/moment.isoduration.js
        var Y = years;
        var M = months;
        var D = days;
        var h = hours;
        var m = minutes;
        var s = seconds ? seconds.toFixed(3).replace(/\.?0+$/, '') : '';
        var total = this.asSeconds();

        if (!total) {
            // this is the same as C#'s (Noda) and python (isodate)...
            // but not other JS (goog.date)
            return 'P0D';
        }

        var totalSign = total < 0 ? '-' : '';
        var ymSign = sign(this._months) !== sign(total) ? '-' : '';
        var daysSign = sign(this._days) !== sign(total) ? '-' : '';
        var hmsSign = sign(this._milliseconds) !== sign(total) ? '-' : '';

        return totalSign + 'P' +
            (Y ? ymSign + Y + 'Y' : '') +
            (M ? ymSign + M + 'M' : '') +
            (D ? daysSign + D + 'D' : '') +
            ((h || m || s) ? 'T' : '') +
            (h ? hmsSign + h + 'H' : '') +
            (m ? hmsSign + m + 'M' : '') +
            (s ? hmsSign + s + 'S' : '');
    }

    var proto$2 = Duration.prototype;

    proto$2.isValid        = isValid$1;
    proto$2.abs            = abs;
    proto$2.add            = add$1;
    proto$2.subtract       = subtract$1;
    proto$2.as             = as;
    proto$2.asMilliseconds = asMilliseconds;
    proto$2.asSeconds      = asSeconds;
    proto$2.asMinutes      = asMinutes;
    proto$2.asHours        = asHours;
    proto$2.asDays         = asDays;
    proto$2.asWeeks        = asWeeks;
    proto$2.asMonths       = asMonths;
    proto$2.asQuarters     = asQuarters;
    proto$2.asYears        = asYears;
    proto$2.valueOf        = valueOf$1;
    proto$2._bubble        = bubble;
    proto$2.clone          = clone$1;
    proto$2.get            = get$2;
    proto$2.milliseconds   = milliseconds;
    proto$2.seconds        = seconds;
    proto$2.minutes        = minutes;
    proto$2.hours          = hours;
    proto$2.days           = days;
    proto$2.weeks          = weeks;
    proto$2.months         = months;
    proto$2.years          = years;
    proto$2.humanize       = humanize;
    proto$2.toISOString    = toISOString$1;
    proto$2.toString       = toISOString$1;
    proto$2.toJSON         = toISOString$1;
    proto$2.locale         = locale;
    proto$2.localeData     = localeData;

    proto$2.toIsoString = deprecate('toIsoString() is deprecated. Please use toISOString() instead (notice the capitals)', toISOString$1);
    proto$2.lang = lang;

    // Side effect imports

    // FORMATTING

    addFormatToken('X', 0, 0, 'unix');
    addFormatToken('x', 0, 0, 'valueOf');

    // PARSING

    addRegexToken('x', matchSigned);
    addRegexToken('X', matchTimestamp);
    addParseToken('X', function (input, array, config) {
        config._d = new Date(parseFloat(input, 10) * 1000);
    });
    addParseToken('x', function (input, array, config) {
        config._d = new Date(toInt(input));
    });

    // Side effect imports


    hooks.version = '2.24.0';

    setHookCallback(createLocal);

    hooks.fn                    = proto;
    hooks.min                   = min;
    hooks.max                   = max;
    hooks.now                   = now;
    hooks.utc                   = createUTC;
    hooks.unix                  = createUnix;
    hooks.months                = listMonths;
    hooks.isDate                = isDate;
    hooks.locale                = getSetGlobalLocale;
    hooks.invalid               = createInvalid;
    hooks.duration              = createDuration;
    hooks.isMoment              = isMoment;
    hooks.weekdays              = listWeekdays;
    hooks.parseZone             = createInZone;
    hooks.localeData            = getLocale;
    hooks.isDuration            = isDuration;
    hooks.monthsShort           = listMonthsShort;
    hooks.weekdaysMin           = listWeekdaysMin;
    hooks.defineLocale          = defineLocale;
    hooks.updateLocale          = updateLocale;
    hooks.locales               = listLocales;
    hooks.weekdaysShort         = listWeekdaysShort;
    hooks.normalizeUnits        = normalizeUnits;
    hooks.relativeTimeRounding  = getSetRelativeTimeRounding;
    hooks.relativeTimeThreshold = getSetRelativeTimeThreshold;
    hooks.calendarFormat        = getCalendarFormat;
    hooks.prototype             = proto;

    // currently HTML5 input type only supports 24-hour formats
    hooks.HTML5_FMT = {
        DATETIME_LOCAL: 'YYYY-MM-DDTHH:mm',             // <input type="datetime-local" />
        DATETIME_LOCAL_SECONDS: 'YYYY-MM-DDTHH:mm:ss',  // <input type="datetime-local" step="1" />
        DATETIME_LOCAL_MS: 'YYYY-MM-DDTHH:mm:ss.SSS',   // <input type="datetime-local" step="0.001" />
        DATE: 'YYYY-MM-DD',                             // <input type="date" />
        TIME: 'HH:mm',                                  // <input type="time" />
        TIME_SECONDS: 'HH:mm:ss',                       // <input type="time" step="1" />
        TIME_MS: 'HH:mm:ss.SSS',                        // <input type="time" step="0.001" />
        WEEK: 'GGGG-[W]WW',                             // <input type="week" />
        MONTH: 'YYYY-MM'                                // <input type="month" />
    };

    return hooks;

})));
//! moment-timezone.js
//! version : 0.5.25
//! Copyright (c) JS Foundation and other contributors
//! license : MIT
//! github.com/moment/moment-timezone

(function (root, factory) {
	"use strict";

	/*global define*/
	if (typeof module === 'object' && module.exports) {
		module.exports = factory(require('moment')); // Node
	} else if (typeof define === 'function' && define.amd) {
		define(['moment'], factory);                 // AMD
	} else {
		factory(root.moment);                        // Browser
	}
}(this, function (moment) {
	"use strict";

	// Do not load moment-timezone a second time.
	// if (moment.tz !== undefined) {
	// 	logError('Moment Timezone ' + moment.tz.version + ' was already loaded ' + (moment.tz.dataVersion ? 'with data from ' : 'without any data') + moment.tz.dataVersion);
	// 	return moment;
	// }

	var VERSION = "0.5.25",
		zones = {},
		links = {},
		names = {},
		guesses = {},
		cachedGuess;

	if (!moment || typeof moment.version !== 'string') {
		logError('Moment Timezone requires Moment.js. See https://momentjs.com/timezone/docs/#/use-it/browser/');
	}

	var momentVersion = moment.version.split('.'),
		major = +momentVersion[0],
		minor = +momentVersion[1];

	// Moment.js version check
	if (major < 2 || (major === 2 && minor < 6)) {
		logError('Moment Timezone requires Moment.js >= 2.6.0. You are using Moment.js ' + moment.version + '. See momentjs.com');
	}

	/************************************
		Unpacking
	************************************/

	function charCodeToInt(charCode) {
		if (charCode > 96) {
			return charCode - 87;
		} else if (charCode > 64) {
			return charCode - 29;
		}
		return charCode - 48;
	}

	function unpackBase60(string) {
		var i = 0,
			parts = string.split('.'),
			whole = parts[0],
			fractional = parts[1] || '',
			multiplier = 1,
			num,
			out = 0,
			sign = 1;

		// handle negative numbers
		if (string.charCodeAt(0) === 45) {
			i = 1;
			sign = -1;
		}

		// handle digits before the decimal
		for (i; i < whole.length; i++) {
			num = charCodeToInt(whole.charCodeAt(i));
			out = 60 * out + num;
		}

		// handle digits after the decimal
		for (i = 0; i < fractional.length; i++) {
			multiplier = multiplier / 60;
			num = charCodeToInt(fractional.charCodeAt(i));
			out += num * multiplier;
		}

		return out * sign;
	}

	function arrayToInt (array) {
		for (var i = 0; i < array.length; i++) {
			array[i] = unpackBase60(array[i]);
		}
	}

	function intToUntil (array, length) {
		for (var i = 0; i < length; i++) {
			array[i] = Math.round((array[i - 1] || 0) + (array[i] * 60000)); // minutes to milliseconds
		}

		array[length - 1] = Infinity;
	}

	function mapIndices (source, indices) {
		var out = [], i;

		for (i = 0; i < indices.length; i++) {
			out[i] = source[indices[i]];
		}

		return out;
	}

	function unpack (string) {
		var data = string.split('|'),
			offsets = data[2].split(' '),
			indices = data[3].split(''),
			untils  = data[4].split(' ');

		arrayToInt(offsets);
		arrayToInt(indices);
		arrayToInt(untils);

		intToUntil(untils, indices.length);

		return {
			name       : data[0],
			abbrs      : mapIndices(data[1].split(' '), indices),
			offsets    : mapIndices(offsets, indices),
			untils     : untils,
			population : data[5] | 0
		};
	}

	/************************************
		Zone object
	************************************/

	function Zone (packedString) {
		if (packedString) {
			this._set(unpack(packedString));
		}
	}

	Zone.prototype = {
		_set : function (unpacked) {
			this.name       = unpacked.name;
			this.abbrs      = unpacked.abbrs;
			this.untils     = unpacked.untils;
			this.offsets    = unpacked.offsets;
			this.population = unpacked.population;
		},

		_index : function (timestamp) {
			var target = +timestamp,
				untils = this.untils,
				i;

			for (i = 0; i < untils.length; i++) {
				if (target < untils[i]) {
					return i;
				}
			}
		},

		parse : function (timestamp) {
			var target  = +timestamp,
				offsets = this.offsets,
				untils  = this.untils,
				max     = untils.length - 1,
				offset, offsetNext, offsetPrev, i;

			for (i = 0; i < max; i++) {
				offset     = offsets[i];
				offsetNext = offsets[i + 1];
				offsetPrev = offsets[i ? i - 1 : i];

				if (offset < offsetNext && tz.moveAmbiguousForward) {
					offset = offsetNext;
				} else if (offset > offsetPrev && tz.moveInvalidForward) {
					offset = offsetPrev;
				}

				if (target < untils[i] - (offset * 60000)) {
					return offsets[i];
				}
			}

			return offsets[max];
		},

		abbr : function (mom) {
			return this.abbrs[this._index(mom)];
		},

		offset : function (mom) {
			logError("zone.offset has been deprecated in favor of zone.utcOffset");
			return this.offsets[this._index(mom)];
		},

		utcOffset : function (mom) {
			return this.offsets[this._index(mom)];
		}
	};

	/************************************
		Current Timezone
	************************************/

	function OffsetAt(at) {
		var timeString = at.toTimeString();
		var abbr = timeString.match(/\([a-z ]+\)/i);
		if (abbr && abbr[0]) {
			// 17:56:31 GMT-0600 (CST)
			// 17:56:31 GMT-0600 (Central Standard Time)
			abbr = abbr[0].match(/[A-Z]/g);
			abbr = abbr ? abbr.join('') : undefined;
		} else {
			// 17:56:31 CST
			// 17:56:31 GMT+0800 (台北標準時間)
			abbr = timeString.match(/[A-Z]{3,5}/g);
			abbr = abbr ? abbr[0] : undefined;
		}

		if (abbr === 'GMT') {
			abbr = undefined;
		}

		this.at = +at;
		this.abbr = abbr;
		this.offset = at.getTimezoneOffset();
	}

	function ZoneScore(zone) {
		this.zone = zone;
		this.offsetScore = 0;
		this.abbrScore = 0;
	}

	ZoneScore.prototype.scoreOffsetAt = function (offsetAt) {
		this.offsetScore += Math.abs(this.zone.utcOffset(offsetAt.at) - offsetAt.offset);
		if (this.zone.abbr(offsetAt.at).replace(/[^A-Z]/g, '') !== offsetAt.abbr) {
			this.abbrScore++;
		}
	};

	function findChange(low, high) {
		var mid, diff;

		while ((diff = ((high.at - low.at) / 12e4 | 0) * 6e4)) {
			mid = new OffsetAt(new Date(low.at + diff));
			if (mid.offset === low.offset) {
				low = mid;
			} else {
				high = mid;
			}
		}

		return low;
	}

	function userOffsets() {
		var startYear = new Date().getFullYear() - 2,
			last = new OffsetAt(new Date(startYear, 0, 1)),
			offsets = [last],
			change, next, i;

		for (i = 1; i < 48; i++) {
			next = new OffsetAt(new Date(startYear, i, 1));
			if (next.offset !== last.offset) {
				change = findChange(last, next);
				offsets.push(change);
				offsets.push(new OffsetAt(new Date(change.at + 6e4)));
			}
			last = next;
		}

		for (i = 0; i < 4; i++) {
			offsets.push(new OffsetAt(new Date(startYear + i, 0, 1)));
			offsets.push(new OffsetAt(new Date(startYear + i, 6, 1)));
		}

		return offsets;
	}

	function sortZoneScores (a, b) {
		if (a.offsetScore !== b.offsetScore) {
			return a.offsetScore - b.offsetScore;
		}
		if (a.abbrScore !== b.abbrScore) {
			return a.abbrScore - b.abbrScore;
		}
		return b.zone.population - a.zone.population;
	}

	function addToGuesses (name, offsets) {
		var i, offset;
		arrayToInt(offsets);
		for (i = 0; i < offsets.length; i++) {
			offset = offsets[i];
			guesses[offset] = guesses[offset] || {};
			guesses[offset][name] = true;
		}
	}

	function guessesForUserOffsets (offsets) {
		var offsetsLength = offsets.length,
			filteredGuesses = {},
			out = [],
			i, j, guessesOffset;

		for (i = 0; i < offsetsLength; i++) {
			guessesOffset = guesses[offsets[i].offset] || {};
			for (j in guessesOffset) {
				if (guessesOffset.hasOwnProperty(j)) {
					filteredGuesses[j] = true;
				}
			}
		}

		for (i in filteredGuesses) {
			if (filteredGuesses.hasOwnProperty(i)) {
				out.push(names[i]);
			}
		}

		return out;
	}

	function rebuildGuess () {

		// use Intl API when available and returning valid time zone
		try {
			var intlName = Intl.DateTimeFormat().resolvedOptions().timeZone;
			if (intlName && intlName.length > 3) {
				var name = names[normalizeName(intlName)];
				if (name) {
					return name;
				}
				logError("Moment Timezone found " + intlName + " from the Intl api, but did not have that data loaded.");
			}
		} catch (e) {
			// Intl unavailable, fall back to manual guessing.
		}

		var offsets = userOffsets(),
			offsetsLength = offsets.length,
			guesses = guessesForUserOffsets(offsets),
			zoneScores = [],
			zoneScore, i, j;

		for (i = 0; i < guesses.length; i++) {
			zoneScore = new ZoneScore(getZone(guesses[i]), offsetsLength);
			for (j = 0; j < offsetsLength; j++) {
				zoneScore.scoreOffsetAt(offsets[j]);
			}
			zoneScores.push(zoneScore);
		}

		zoneScores.sort(sortZoneScores);

		return zoneScores.length > 0 ? zoneScores[0].zone.name : undefined;
	}

	function guess (ignoreCache) {
		if (!cachedGuess || ignoreCache) {
			cachedGuess = rebuildGuess();
		}
		return cachedGuess;
	}

	/************************************
		Global Methods
	************************************/

	function normalizeName (name) {
		return (name || '').toLowerCase().replace(/\//g, '_');
	}

	function addZone (packed) {
		var i, name, split, normalized;

		if (typeof packed === "string") {
			packed = [packed];
		}

		for (i = 0; i < packed.length; i++) {
			split = packed[i].split('|');
			name = split[0];
			normalized = normalizeName(name);
			zones[normalized] = packed[i];
			names[normalized] = name;
			addToGuesses(normalized, split[2].split(' '));
		}
	}

	function getZone (name, caller) {
		
		name = normalizeName(name);

		var zone = zones[name];
		var link;

		if (zone instanceof Zone) {
			return zone;
		}

		if (typeof zone === 'string') {
			zone = new Zone(zone);
			zones[name] = zone;
			return zone;
		}

		// Pass getZone to prevent recursion more than 1 level deep
		if (links[name] && caller !== getZone && (link = getZone(links[name], getZone))) {
			zone = zones[name] = new Zone();
			zone._set(link);
			zone.name = names[name];
			return zone;
		}

		return null;
	}

	function getNames () {
		var i, out = [];

		for (i in names) {
			if (names.hasOwnProperty(i) && (zones[i] || zones[links[i]]) && names[i]) {
				out.push(names[i]);
			}
		}

		return out.sort();
	}

	function addLink (aliases) {
		var i, alias, normal0, normal1;

		if (typeof aliases === "string") {
			aliases = [aliases];
		}

		for (i = 0; i < aliases.length; i++) {
			alias = aliases[i].split('|');

			normal0 = normalizeName(alias[0]);
			normal1 = normalizeName(alias[1]);

			links[normal0] = normal1;
			names[normal0] = alias[0];

			links[normal1] = normal0;
			names[normal1] = alias[1];
		}
	}

	function loadData (data) {
		addZone(data.zones);
		addLink(data.links);
		tz.dataVersion = data.version;
	}

	function zoneExists (name) {
		if (!zoneExists.didShowError) {
			zoneExists.didShowError = true;
				logError("moment.tz.zoneExists('" + name + "') has been deprecated in favor of !moment.tz.zone('" + name + "')");
		}
		return !!getZone(name);
	}

	function needsOffset (m) {
		var isUnixTimestamp = (m._f === 'X' || m._f === 'x');
		return !!(m._a && (m._tzm === undefined) && !isUnixTimestamp);
	}

	function logError (message) {
		if (typeof console !== 'undefined' && typeof console.error === 'function') {
			console.error(message);
		}
	}

	/************************************
		moment.tz namespace
	************************************/

	function tz (input) {
		var args = Array.prototype.slice.call(arguments, 0, -1),
			name = arguments[arguments.length - 1],
			zone = getZone(name),
			out  = moment.utc.apply(null, args);

		if (zone && !moment.isMoment(input) && needsOffset(out)) {
			out.add(zone.parse(out), 'minutes');
		}

		out.tz(name);

		return out;
	}

	tz.version      = VERSION;
	tz.dataVersion  = '';
	tz._zones       = zones;
	tz._links       = links;
	tz._names       = names;
	tz.add          = addZone;
	tz.link         = addLink;
	tz.load         = loadData;
	tz.zone         = getZone;
	tz.zoneExists   = zoneExists; // deprecated in 0.1.0
	tz.guess        = guess;
	tz.names        = getNames;
	tz.Zone         = Zone;
	tz.unpack       = unpack;
	tz.unpackBase60 = unpackBase60;
	tz.needsOffset  = needsOffset;
	tz.moveInvalidForward   = true;
	tz.moveAmbiguousForward = false;

	/************************************
		Interface with Moment.js
	************************************/

	var fn = moment.fn;

	moment.tz = tz;

	moment.defaultZone = null;

	moment.updateOffset = function (mom, keepTime) {
		var zone = moment.defaultZone,
			offset;

		if (mom._z === undefined) {
			if (zone && needsOffset(mom) && !mom._isUTC) {
				mom._d = moment.utc(mom._a)._d;
				mom.utc().add(zone.parse(mom), 'minutes');
			}
			mom._z = zone;
		}
		if (mom._z) {
			offset = mom._z.utcOffset(mom);
			if (Math.abs(offset) < 16) {
				offset = offset / 60;
			}
			if (mom.utcOffset !== undefined) {
				var z = mom._z;
				mom.utcOffset(-offset, keepTime);
				mom._z = z;
			} else {
				mom.zone(offset, keepTime);
			}
		}
	};

	fn.tz = function (name, keepTime) {
		if (name) {
			if (typeof name !== 'string') {
				throw new Error('Time zone name must be a string, got ' + name + ' [' + typeof name + ']');
			}
			this._z = getZone(name);
			if (this._z) {
				moment.updateOffset(this, keepTime);
			} else {
				logError("Moment Timezone has no data for " + name + ". See http://momentjs.com/timezone/docs/#/data-loading/.");
			}
			return this;
		}
		if (this._z) { return this._z.name; }
	};

	function abbrWrap (old) {
		return function () {
			if (this._z) { return this._z.abbr(this); }
			return old.call(this);
		};
	}

	function resetZoneWrap (old) {
		return function () {
			this._z = null;
			return old.apply(this, arguments);
		};
	}

	function resetZoneWrap2 (old) {
		return function () {
			if (arguments.length > 0) this._z = null;
			return old.apply(this, arguments);
		};
	}

	fn.zoneName  = abbrWrap(fn.zoneName);
	fn.zoneAbbr  = abbrWrap(fn.zoneAbbr);
	fn.utc       = resetZoneWrap(fn.utc);
	fn.local     = resetZoneWrap(fn.local);
	fn.utcOffset = resetZoneWrap2(fn.utcOffset);
	
	moment.tz.setDefault = function(name) {
		if (major < 2 || (major === 2 && minor < 9)) {
			logError('Moment Timezone setDefault() requires Moment.js >= 2.9.0. You are using Moment.js ' + moment.version + '.');
		}
		moment.defaultZone = name ? getZone(name) : null;
		return moment;
	};

	// Cloning a moment should include the _z property.
	var momentProperties = moment.momentProperties;
	if (Object.prototype.toString.call(momentProperties) === '[object Array]') {
		// moment 2.8.1+
		momentProperties.push('_z');
		momentProperties.push('_a');
	} else if (momentProperties) {
		// moment 2.7.0
		momentProperties._z = null;
	}

	loadData({
		"version": "2019a",
		"zones": [
			"Africa/Abidjan|GMT|0|0||48e5",
			"Africa/Nairobi|EAT|-30|0||47e5",
			"Africa/Algiers|CET|-10|0||26e5",
			"Africa/Lagos|WAT|-10|0||17e6",
			"Africa/Maputo|CAT|-20|0||26e5",
			"Africa/Cairo|EET EEST|-20 -30|01010|1M2m0 gL0 e10 mn0|15e6",
			"Africa/Casablanca|+00 +01|0 -10|01010101010101010101010101010101|1LHC0 A00 e00 y00 11A0 uM0 e00 Dc0 11A0 s00 e00 IM0 WM0 mo0 gM0 LA0 WM0 jA0 e00 28M0 e00 2600 e00 28M0 e00 2600 gM0 2600 e00 28M0 e00|32e5",
			"Europe/Paris|CET CEST|-10 -20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|11e6",
			"Africa/Johannesburg|SAST|-20|0||84e5",
			"Africa/Khartoum|EAT CAT|-30 -20|01|1Usl0|51e5",
			"Africa/Sao_Tome|GMT WAT|0 -10|010|1UQN0 2q00",
			"Africa/Tripoli|EET|-20|0||11e5",
			"Africa/Windhoek|CAT WAT|-20 -10|010101010|1LKo0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0|32e4",
			"America/Adak|HST HDT|a0 90|01010101010101010101010|1Lzo0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|326",
			"America/Anchorage|AKST AKDT|90 80|01010101010101010101010|1Lzn0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|30e4",
			"America/Santo_Domingo|AST|40|0||29e5",
			"America/Fortaleza|-03|30|0||34e5",
			"America/Asuncion|-03 -04|30 40|01010101010101010101010|1LEP0 1ip0 17b0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1ip0 17b0 1ip0 17b0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1fB0 19X0 1ip0|28e5",
			"America/Panama|EST|50|0||15e5",
			"America/Mexico_City|CST CDT|60 50|01010101010101010101010|1LKw0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0|20e6",
			"America/Managua|CST|60|0||22e5",
			"America/La_Paz|-04|40|0||19e5",
			"America/Lima|-05|50|0||11e6",
			"America/Denver|MST MDT|70 60|01010101010101010101010|1Lzl0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|26e5",
			"America/Campo_Grande|-03 -04|30 40|01010101010101010101010|1LqP0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1HB0 FX0 1HB0 FX0 1HB0 IL0 1HB0 FX0 1HB0 IL0 1EN0 FX0 1HB0|77e4",
			"America/Cancun|CST CDT EST|60 50 50|0102|1LKw0 1lb0 Dd0|63e4",
			"America/Caracas|-0430 -04|4u 40|01|1QMT0|29e5",
			"America/Chicago|CST CDT|60 50|01010101010101010101010|1Lzk0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|92e5",
			"America/Chihuahua|MST MDT|70 60|01010101010101010101010|1LKx0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0|81e4",
			"America/Phoenix|MST|70|0||42e5",
			"America/Los_Angeles|PST PDT|80 70|01010101010101010101010|1Lzm0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|15e6",
			"America/New_York|EST EDT|50 40|01010101010101010101010|1Lzj0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|21e6",
			"America/Fort_Nelson|PST PDT MST|80 70 70|0102|1Lzm0 1zb0 Op0|39e2",
			"America/Halifax|AST ADT|40 30|01010101010101010101010|1Lzi0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|39e4",
			"America/Godthab|-03 -02|30 20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|17e3",
			"America/Grand_Turk|EST EDT AST|50 40 40|0101210101010101010|1Lzj0 1zb0 Op0 1zb0 5Ip0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|37e2",
			"America/Havana|CST CDT|50 40|01010101010101010101010|1Lzh0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0|21e5",
			"America/Metlakatla|PST AKST AKDT|80 90 80|012121201212121212121|1PAa0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 uM0 jB0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|14e2",
			"America/Miquelon|-03 -02|30 20|01010101010101010101010|1Lzh0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|61e2",
			"America/Montevideo|-02 -03|20 30|0101|1Lzg0 1o10 11z0|17e5",
			"America/Noronha|-02|20|0||30e2",
			"America/Port-au-Prince|EST EDT|50 40|010101010101010101010|1Lzj0 1zb0 Op0 1zb0 3iN0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|23e5",
			"Antarctica/Palmer|-03 -04|30 40|01010|1LSP0 Rd0 46n0 Ap0|40",
			"America/Santiago|-03 -04|30 40|010101010101010101010|1LSP0 Rd0 46n0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1zb0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 11B0|62e5",
			"America/Sao_Paulo|-02 -03|20 30|01010101010101010101010|1LqO0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1HB0 FX0 1HB0 FX0 1HB0 IL0 1HB0 FX0 1HB0 IL0 1EN0 FX0 1HB0|20e6",
			"Atlantic/Azores|-01 +00|10 0|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|25e4",
			"America/St_Johns|NST NDT|3u 2u|01010101010101010101010|1Lzhu 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|11e4",
			"Antarctica/Casey|+08 +11|-80 -b0|010|1RWg0 3m10|10",
			"Asia/Bangkok|+07|-70|0||15e6",
			"Pacific/Port_Moresby|+10|-a0|0||25e4",
			"Pacific/Guadalcanal|+11|-b0|0||11e4",
			"Asia/Tashkent|+05|-50|0||23e5",
			"Pacific/Auckland|NZDT NZST|-d0 -c0|01010101010101010101010|1LKe0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00|14e5",
			"Asia/Baghdad|+03|-30|0||66e5",
			"Antarctica/Troll|+00 +02|0 -20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|40",
			"Asia/Dhaka|+06|-60|0||16e6",
			"Asia/Amman|EET EEST|-20 -30|01010101010101010101010|1LGK0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00|25e5",
			"Asia/Kamchatka|+12|-c0|0||18e4",
			"Asia/Baku|+04 +05|-40 -50|01010|1LHA0 1o00 11A0 1o00|27e5",
			"Asia/Barnaul|+07 +06|-70 -60|010|1N7v0 3rd0",
			"Asia/Beirut|EET EEST|-20 -30|01010101010101010101010|1LHy0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0|22e5",
			"Asia/Kuala_Lumpur|+08|-80|0||71e5",
			"Asia/Kolkata|IST|-5u|0||15e6",
			"Asia/Chita|+10 +08 +09|-a0 -80 -90|012|1N7s0 3re0|33e4",
			"Asia/Ulaanbaatar|+08 +09|-80 -90|01010|1O8G0 1cJ0 1cP0 1cJ0|12e5",
			"Asia/Shanghai|CST|-80|0||23e6",
			"Asia/Colombo|+0530|-5u|0||22e5",
			"Asia/Damascus|EET EEST|-20 -30|01010101010101010101010|1LGK0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0|26e5",
			"Asia/Dili|+09|-90|0||19e4",
			"Asia/Dubai|+04|-40|0||39e5",
			"Asia/Famagusta|EET EEST +03|-20 -30 -30|0101012010101010101010|1LHB0 1o00 11A0 1o00 11A0 15U0 2Ks0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00",
			"Asia/Gaza|EET EEST|-20 -30|01010101010101010101010|1LGK0 1nX0 1210 1nz0 1220 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0|18e5",
			"Asia/Hong_Kong|HKT|-80|0||73e5",
			"Asia/Hovd|+07 +08|-70 -80|01010|1O8H0 1cJ0 1cP0 1cJ0|81e3",
			"Asia/Irkutsk|+09 +08|-90 -80|01|1N7t0|60e4",
			"Europe/Istanbul|EET EEST +03|-20 -30 -30|0101012|1LI10 1nA0 11A0 1tA0 U00 15w0|13e6",
			"Asia/Jakarta|WIB|-70|0||31e6",
			"Asia/Jayapura|WIT|-90|0||26e4",
			"Asia/Jerusalem|IST IDT|-20 -30|01010101010101010101010|1LGM0 1oL0 10N0 1oL0 10N0 1rz0 W10 1rz0 W10 1rz0 10N0 1oL0 10N0 1oL0 10N0 1rz0 W10 1rz0 W10 1rz0 10N0 1oL0|81e4",
			"Asia/Kabul|+0430|-4u|0||46e5",
			"Asia/Karachi|PKT|-50|0||24e6",
			"Asia/Kathmandu|+0545|-5J|0||12e5",
			"Asia/Yakutsk|+10 +09|-a0 -90|01|1N7s0|28e4",
			"Asia/Krasnoyarsk|+08 +07|-80 -70|01|1N7u0|10e5",
			"Asia/Magadan|+12 +10 +11|-c0 -a0 -b0|012|1N7q0 3Cq0|95e3",
			"Asia/Makassar|WITA|-80|0||15e5",
			"Asia/Manila|PST|-80|0||24e6",
			"Europe/Athens|EET EEST|-20 -30|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|35e5",
			"Asia/Novosibirsk|+07 +06|-70 -60|010|1N7v0 4eN0|15e5",
			"Asia/Omsk|+07 +06|-70 -60|01|1N7v0|12e5",
			"Asia/Pyongyang|KST KST|-90 -8u|010|1P4D0 6BA0|29e5",
			"Asia/Qyzylorda|+06 +05|-60 -50|01|1Xei0|73e4",
			"Asia/Rangoon|+0630|-6u|0||48e5",
			"Asia/Sakhalin|+11 +10|-b0 -a0|010|1N7r0 3rd0|58e4",
			"Asia/Seoul|KST|-90|0||23e6",
			"Asia/Srednekolymsk|+12 +11|-c0 -b0|01|1N7q0|35e2",
			"Asia/Tehran|+0330 +0430|-3u -4u|01010101010101010101010|1LEku 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0|14e6",
			"Asia/Tokyo|JST|-90|0||38e6",
			"Asia/Tomsk|+07 +06|-70 -60|010|1N7v0 3Qp0|10e5",
			"Asia/Vladivostok|+11 +10|-b0 -a0|01|1N7r0|60e4",
			"Asia/Yekaterinburg|+06 +05|-60 -50|01|1N7w0|14e5",
			"Europe/Lisbon|WET WEST|0 -10|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|27e5",
			"Atlantic/Cape_Verde|-01|10|0||50e4",
			"Australia/Sydney|AEDT AEST|-b0 -a0|01010101010101010101010|1LKg0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0|40e5",
			"Australia/Adelaide|ACDT ACST|-au -9u|01010101010101010101010|1LKgu 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0|11e5",
			"Australia/Brisbane|AEST|-a0|0||20e5",
			"Australia/Darwin|ACST|-9u|0||12e4",
			"Australia/Eucla|+0845|-8J|0||368",
			"Australia/Lord_Howe|+11 +1030|-b0 -au|01010101010101010101010|1LKf0 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1fAu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1fzu 1cMu|347",
			"Australia/Perth|AWST|-80|0||18e5",
			"Pacific/Easter|-05 -06|50 60|010101010101010101010|1LSP0 Rd0 46n0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1zb0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 11B0|30e2",
			"Europe/Dublin|GMT IST|0 -10|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|12e5",
			"Etc/GMT-1|+01|-10|0|",
			"Pacific/Fakaofo|+13|-d0|0||483",
			"Pacific/Kiritimati|+14|-e0|0||51e2",
			"Etc/GMT-2|+02|-20|0|",
			"Pacific/Tahiti|-10|a0|0||18e4",
			"Pacific/Niue|-11|b0|0||12e2",
			"Etc/GMT+12|-12|c0|0|",
			"Pacific/Galapagos|-06|60|0||25e3",
			"Etc/GMT+7|-07|70|0|",
			"Pacific/Pitcairn|-08|80|0||56",
			"Pacific/Gambier|-09|90|0||125",
			"Etc/UTC|UTC|0|0|",
			"Europe/Ulyanovsk|+04 +03|-40 -30|010|1N7y0 3rd0|13e5",
			"Europe/London|GMT BST|0 -10|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|10e6",
			"Europe/Chisinau|EET EEST|-20 -30|01010101010101010101010|1LHA0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|67e4",
			"Europe/Kaliningrad|+03 EET|-30 -20|01|1N7z0|44e4",
			"Europe/Kirov|+04 +03|-40 -30|01|1N7y0|48e4",
			"Europe/Moscow|MSK MSK|-40 -30|01|1N7y0|16e6",
			"Europe/Saratov|+04 +03|-40 -30|010|1N7y0 5810",
			"Europe/Simferopol|EET MSK MSK|-20 -40 -30|012|1LHA0 1nW0|33e4",
			"Europe/Volgograd|+04 +03|-40 -30|010|1N7y0 9Jd0|10e5",
			"Pacific/Honolulu|HST|a0|0||37e4",
			"MET|MET MEST|-10 -20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00",
			"Pacific/Chatham|+1345 +1245|-dJ -cJ|01010101010101010101010|1LKe0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00|600",
			"Pacific/Apia|+14 +13|-e0 -d0|01010101010101010101010|1LKe0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00|37e3",
			"Pacific/Bougainville|+10 +11|-a0 -b0|01|1NwE0|18e4",
			"Pacific/Fiji|+13 +12|-d0 -c0|01010101010101010101010|1Lfp0 1SN0 uM0 1SM0 uM0 1VA0 s00 1VA0 s00 1VA0 s00 1VA0 uM0 1SM0 uM0 1VA0 s00 1VA0 s00 1VA0 s00 1VA0|88e4",
			"Pacific/Guam|ChST|-a0|0||17e4",
			"Pacific/Marquesas|-0930|9u|0||86e2",
			"Pacific/Pago_Pago|SST|b0|0||37e2",
			"Pacific/Norfolk|+1130 +11|-bu -b0|01|1PoCu|25e4",
			"Pacific/Tongatapu|+13 +14|-d0 -e0|010|1S4d0 s00|75e3"
		],
		"links": [
			"Africa/Abidjan|Africa/Accra",
			"Africa/Abidjan|Africa/Bamako",
			"Africa/Abidjan|Africa/Banjul",
			"Africa/Abidjan|Africa/Bissau",
			"Africa/Abidjan|Africa/Conakry",
			"Africa/Abidjan|Africa/Dakar",
			"Africa/Abidjan|Africa/Freetown",
			"Africa/Abidjan|Africa/Lome",
			"Africa/Abidjan|Africa/Monrovia",
			"Africa/Abidjan|Africa/Nouakchott",
			"Africa/Abidjan|Africa/Ouagadougou",
			"Africa/Abidjan|Africa/Timbuktu",
			"Africa/Abidjan|America/Danmarkshavn",
			"Africa/Abidjan|Atlantic/Reykjavik",
			"Africa/Abidjan|Atlantic/St_Helena",
			"Africa/Abidjan|Etc/GMT",
			"Africa/Abidjan|Etc/GMT+0",
			"Africa/Abidjan|Etc/GMT-0",
			"Africa/Abidjan|Etc/GMT0",
			"Africa/Abidjan|Etc/Greenwich",
			"Africa/Abidjan|GMT",
			"Africa/Abidjan|GMT+0",
			"Africa/Abidjan|GMT-0",
			"Africa/Abidjan|GMT0",
			"Africa/Abidjan|Greenwich",
			"Africa/Abidjan|Iceland",
			"Africa/Algiers|Africa/Tunis",
			"Africa/Cairo|Egypt",
			"Africa/Casablanca|Africa/El_Aaiun",
			"Africa/Johannesburg|Africa/Maseru",
			"Africa/Johannesburg|Africa/Mbabane",
			"Africa/Lagos|Africa/Bangui",
			"Africa/Lagos|Africa/Brazzaville",
			"Africa/Lagos|Africa/Douala",
			"Africa/Lagos|Africa/Kinshasa",
			"Africa/Lagos|Africa/Libreville",
			"Africa/Lagos|Africa/Luanda",
			"Africa/Lagos|Africa/Malabo",
			"Africa/Lagos|Africa/Ndjamena",
			"Africa/Lagos|Africa/Niamey",
			"Africa/Lagos|Africa/Porto-Novo",
			"Africa/Maputo|Africa/Blantyre",
			"Africa/Maputo|Africa/Bujumbura",
			"Africa/Maputo|Africa/Gaborone",
			"Africa/Maputo|Africa/Harare",
			"Africa/Maputo|Africa/Kigali",
			"Africa/Maputo|Africa/Lubumbashi",
			"Africa/Maputo|Africa/Lusaka",
			"Africa/Nairobi|Africa/Addis_Ababa",
			"Africa/Nairobi|Africa/Asmara",
			"Africa/Nairobi|Africa/Asmera",
			"Africa/Nairobi|Africa/Dar_es_Salaam",
			"Africa/Nairobi|Africa/Djibouti",
			"Africa/Nairobi|Africa/Juba",
			"Africa/Nairobi|Africa/Kampala",
			"Africa/Nairobi|Africa/Mogadishu",
			"Africa/Nairobi|Indian/Antananarivo",
			"Africa/Nairobi|Indian/Comoro",
			"Africa/Nairobi|Indian/Mayotte",
			"Africa/Tripoli|Libya",
			"America/Adak|America/Atka",
			"America/Adak|US/Aleutian",
			"America/Anchorage|America/Juneau",
			"America/Anchorage|America/Nome",
			"America/Anchorage|America/Sitka",
			"America/Anchorage|America/Yakutat",
			"America/Anchorage|US/Alaska",
			"America/Campo_Grande|America/Cuiaba",
			"America/Chicago|America/Indiana/Knox",
			"America/Chicago|America/Indiana/Tell_City",
			"America/Chicago|America/Knox_IN",
			"America/Chicago|America/Matamoros",
			"America/Chicago|America/Menominee",
			"America/Chicago|America/North_Dakota/Beulah",
			"America/Chicago|America/North_Dakota/Center",
			"America/Chicago|America/North_Dakota/New_Salem",
			"America/Chicago|America/Rainy_River",
			"America/Chicago|America/Rankin_Inlet",
			"America/Chicago|America/Resolute",
			"America/Chicago|America/Winnipeg",
			"America/Chicago|CST6CDT",
			"America/Chicago|Canada/Central",
			"America/Chicago|US/Central",
			"America/Chicago|US/Indiana-Starke",
			"America/Chihuahua|America/Mazatlan",
			"America/Chihuahua|Mexico/BajaSur",
			"America/Denver|America/Boise",
			"America/Denver|America/Cambridge_Bay",
			"America/Denver|America/Edmonton",
			"America/Denver|America/Inuvik",
			"America/Denver|America/Ojinaga",
			"America/Denver|America/Shiprock",
			"America/Denver|America/Yellowknife",
			"America/Denver|Canada/Mountain",
			"America/Denver|MST7MDT",
			"America/Denver|Navajo",
			"America/Denver|US/Mountain",
			"America/Fortaleza|America/Araguaina",
			"America/Fortaleza|America/Argentina/Buenos_Aires",
			"America/Fortaleza|America/Argentina/Catamarca",
			"America/Fortaleza|America/Argentina/ComodRivadavia",
			"America/Fortaleza|America/Argentina/Cordoba",
			"America/Fortaleza|America/Argentina/Jujuy",
			"America/Fortaleza|America/Argentina/La_Rioja",
			"America/Fortaleza|America/Argentina/Mendoza",
			"America/Fortaleza|America/Argentina/Rio_Gallegos",
			"America/Fortaleza|America/Argentina/Salta",
			"America/Fortaleza|America/Argentina/San_Juan",
			"America/Fortaleza|America/Argentina/San_Luis",
			"America/Fortaleza|America/Argentina/Tucuman",
			"America/Fortaleza|America/Argentina/Ushuaia",
			"America/Fortaleza|America/Bahia",
			"America/Fortaleza|America/Belem",
			"America/Fortaleza|America/Buenos_Aires",
			"America/Fortaleza|America/Catamarca",
			"America/Fortaleza|America/Cayenne",
			"America/Fortaleza|America/Cordoba",
			"America/Fortaleza|America/Jujuy",
			"America/Fortaleza|America/Maceio",
			"America/Fortaleza|America/Mendoza",
			"America/Fortaleza|America/Paramaribo",
			"America/Fortaleza|America/Recife",
			"America/Fortaleza|America/Rosario",
			"America/Fortaleza|America/Santarem",
			"America/Fortaleza|Antarctica/Rothera",
			"America/Fortaleza|Atlantic/Stanley",
			"America/Fortaleza|Etc/GMT+3",
			"America/Halifax|America/Glace_Bay",
			"America/Halifax|America/Goose_Bay",
			"America/Halifax|America/Moncton",
			"America/Halifax|America/Thule",
			"America/Halifax|Atlantic/Bermuda",
			"America/Halifax|Canada/Atlantic",
			"America/Havana|Cuba",
			"America/La_Paz|America/Boa_Vista",
			"America/La_Paz|America/Guyana",
			"America/La_Paz|America/Manaus",
			"America/La_Paz|America/Porto_Velho",
			"America/La_Paz|Brazil/West",
			"America/La_Paz|Etc/GMT+4",
			"America/Lima|America/Bogota",
			"America/Lima|America/Eirunepe",
			"America/Lima|America/Guayaquil",
			"America/Lima|America/Porto_Acre",
			"America/Lima|America/Rio_Branco",
			"America/Lima|Brazil/Acre",
			"America/Lima|Etc/GMT+5",
			"America/Los_Angeles|America/Dawson",
			"America/Los_Angeles|America/Ensenada",
			"America/Los_Angeles|America/Santa_Isabel",
			"America/Los_Angeles|America/Tijuana",
			"America/Los_Angeles|America/Vancouver",
			"America/Los_Angeles|America/Whitehorse",
			"America/Los_Angeles|Canada/Pacific",
			"America/Los_Angeles|Canada/Yukon",
			"America/Los_Angeles|Mexico/BajaNorte",
			"America/Los_Angeles|PST8PDT",
			"America/Los_Angeles|US/Pacific",
			"America/Los_Angeles|US/Pacific-New",
			"America/Managua|America/Belize",
			"America/Managua|America/Costa_Rica",
			"America/Managua|America/El_Salvador",
			"America/Managua|America/Guatemala",
			"America/Managua|America/Regina",
			"America/Managua|America/Swift_Current",
			"America/Managua|America/Tegucigalpa",
			"America/Managua|Canada/Saskatchewan",
			"America/Mexico_City|America/Bahia_Banderas",
			"America/Mexico_City|America/Merida",
			"America/Mexico_City|America/Monterrey",
			"America/Mexico_City|Mexico/General",
			"America/New_York|America/Detroit",
			"America/New_York|America/Fort_Wayne",
			"America/New_York|America/Indiana/Indianapolis",
			"America/New_York|America/Indiana/Marengo",
			"America/New_York|America/Indiana/Petersburg",
			"America/New_York|America/Indiana/Vevay",
			"America/New_York|America/Indiana/Vincennes",
			"America/New_York|America/Indiana/Winamac",
			"America/New_York|America/Indianapolis",
			"America/New_York|America/Iqaluit",
			"America/New_York|America/Kentucky/Louisville",
			"America/New_York|America/Kentucky/Monticello",
			"America/New_York|America/Louisville",
			"America/New_York|America/Montreal",
			"America/New_York|America/Nassau",
			"America/New_York|America/Nipigon",
			"America/New_York|America/Pangnirtung",
			"America/New_York|America/Thunder_Bay",
			"America/New_York|America/Toronto",
			"America/New_York|Canada/Eastern",
			"America/New_York|EST5EDT",
			"America/New_York|US/East-Indiana",
			"America/New_York|US/Eastern",
			"America/New_York|US/Michigan",
			"America/Noronha|Atlantic/South_Georgia",
			"America/Noronha|Brazil/DeNoronha",
			"America/Noronha|Etc/GMT+2",
			"America/Panama|America/Atikokan",
			"America/Panama|America/Cayman",
			"America/Panama|America/Coral_Harbour",
			"America/Panama|America/Jamaica",
			"America/Panama|EST",
			"America/Panama|Jamaica",
			"America/Phoenix|America/Creston",
			"America/Phoenix|America/Dawson_Creek",
			"America/Phoenix|America/Hermosillo",
			"America/Phoenix|MST",
			"America/Phoenix|US/Arizona",
			"America/Santiago|Chile/Continental",
			"America/Santo_Domingo|America/Anguilla",
			"America/Santo_Domingo|America/Antigua",
			"America/Santo_Domingo|America/Aruba",
			"America/Santo_Domingo|America/Barbados",
			"America/Santo_Domingo|America/Blanc-Sablon",
			"America/Santo_Domingo|America/Curacao",
			"America/Santo_Domingo|America/Dominica",
			"America/Santo_Domingo|America/Grenada",
			"America/Santo_Domingo|America/Guadeloupe",
			"America/Santo_Domingo|America/Kralendijk",
			"America/Santo_Domingo|America/Lower_Princes",
			"America/Santo_Domingo|America/Marigot",
			"America/Santo_Domingo|America/Martinique",
			"America/Santo_Domingo|America/Montserrat",
			"America/Santo_Domingo|America/Port_of_Spain",
			"America/Santo_Domingo|America/Puerto_Rico",
			"America/Santo_Domingo|America/St_Barthelemy",
			"America/Santo_Domingo|America/St_Kitts",
			"America/Santo_Domingo|America/St_Lucia",
			"America/Santo_Domingo|America/St_Thomas",
			"America/Santo_Domingo|America/St_Vincent",
			"America/Santo_Domingo|America/Tortola",
			"America/Santo_Domingo|America/Virgin",
			"America/Sao_Paulo|Brazil/East",
			"America/St_Johns|Canada/Newfoundland",
			"Antarctica/Palmer|America/Punta_Arenas",
			"Asia/Baghdad|Antarctica/Syowa",
			"Asia/Baghdad|Asia/Aden",
			"Asia/Baghdad|Asia/Bahrain",
			"Asia/Baghdad|Asia/Kuwait",
			"Asia/Baghdad|Asia/Qatar",
			"Asia/Baghdad|Asia/Riyadh",
			"Asia/Baghdad|Etc/GMT-3",
			"Asia/Baghdad|Europe/Minsk",
			"Asia/Bangkok|Antarctica/Davis",
			"Asia/Bangkok|Asia/Ho_Chi_Minh",
			"Asia/Bangkok|Asia/Novokuznetsk",
			"Asia/Bangkok|Asia/Phnom_Penh",
			"Asia/Bangkok|Asia/Saigon",
			"Asia/Bangkok|Asia/Vientiane",
			"Asia/Bangkok|Etc/GMT-7",
			"Asia/Bangkok|Indian/Christmas",
			"Asia/Dhaka|Antarctica/Vostok",
			"Asia/Dhaka|Asia/Almaty",
			"Asia/Dhaka|Asia/Bishkek",
			"Asia/Dhaka|Asia/Dacca",
			"Asia/Dhaka|Asia/Kashgar",
			"Asia/Dhaka|Asia/Qostanay",
			"Asia/Dhaka|Asia/Thimbu",
			"Asia/Dhaka|Asia/Thimphu",
			"Asia/Dhaka|Asia/Urumqi",
			"Asia/Dhaka|Etc/GMT-6",
			"Asia/Dhaka|Indian/Chagos",
			"Asia/Dili|Etc/GMT-9",
			"Asia/Dili|Pacific/Palau",
			"Asia/Dubai|Asia/Muscat",
			"Asia/Dubai|Asia/Tbilisi",
			"Asia/Dubai|Asia/Yerevan",
			"Asia/Dubai|Etc/GMT-4",
			"Asia/Dubai|Europe/Samara",
			"Asia/Dubai|Indian/Mahe",
			"Asia/Dubai|Indian/Mauritius",
			"Asia/Dubai|Indian/Reunion",
			"Asia/Gaza|Asia/Hebron",
			"Asia/Hong_Kong|Hongkong",
			"Asia/Jakarta|Asia/Pontianak",
			"Asia/Jerusalem|Asia/Tel_Aviv",
			"Asia/Jerusalem|Israel",
			"Asia/Kamchatka|Asia/Anadyr",
			"Asia/Kamchatka|Etc/GMT-12",
			"Asia/Kamchatka|Kwajalein",
			"Asia/Kamchatka|Pacific/Funafuti",
			"Asia/Kamchatka|Pacific/Kwajalein",
			"Asia/Kamchatka|Pacific/Majuro",
			"Asia/Kamchatka|Pacific/Nauru",
			"Asia/Kamchatka|Pacific/Tarawa",
			"Asia/Kamchatka|Pacific/Wake",
			"Asia/Kamchatka|Pacific/Wallis",
			"Asia/Kathmandu|Asia/Katmandu",
			"Asia/Kolkata|Asia/Calcutta",
			"Asia/Kuala_Lumpur|Asia/Brunei",
			"Asia/Kuala_Lumpur|Asia/Kuching",
			"Asia/Kuala_Lumpur|Asia/Singapore",
			"Asia/Kuala_Lumpur|Etc/GMT-8",
			"Asia/Kuala_Lumpur|Singapore",
			"Asia/Makassar|Asia/Ujung_Pandang",
			"Asia/Rangoon|Asia/Yangon",
			"Asia/Rangoon|Indian/Cocos",
			"Asia/Seoul|ROK",
			"Asia/Shanghai|Asia/Chongqing",
			"Asia/Shanghai|Asia/Chungking",
			"Asia/Shanghai|Asia/Harbin",
			"Asia/Shanghai|Asia/Macao",
			"Asia/Shanghai|Asia/Macau",
			"Asia/Shanghai|Asia/Taipei",
			"Asia/Shanghai|PRC",
			"Asia/Shanghai|ROC",
			"Asia/Tashkent|Antarctica/Mawson",
			"Asia/Tashkent|Asia/Aqtau",
			"Asia/Tashkent|Asia/Aqtobe",
			"Asia/Tashkent|Asia/Ashgabat",
			"Asia/Tashkent|Asia/Ashkhabad",
			"Asia/Tashkent|Asia/Atyrau",
			"Asia/Tashkent|Asia/Dushanbe",
			"Asia/Tashkent|Asia/Oral",
			"Asia/Tashkent|Asia/Samarkand",
			"Asia/Tashkent|Etc/GMT-5",
			"Asia/Tashkent|Indian/Kerguelen",
			"Asia/Tashkent|Indian/Maldives",
			"Asia/Tehran|Iran",
			"Asia/Tokyo|Japan",
			"Asia/Ulaanbaatar|Asia/Choibalsan",
			"Asia/Ulaanbaatar|Asia/Ulan_Bator",
			"Asia/Vladivostok|Asia/Ust-Nera",
			"Asia/Yakutsk|Asia/Khandyga",
			"Atlantic/Azores|America/Scoresbysund",
			"Atlantic/Cape_Verde|Etc/GMT+1",
			"Australia/Adelaide|Australia/Broken_Hill",
			"Australia/Adelaide|Australia/South",
			"Australia/Adelaide|Australia/Yancowinna",
			"Australia/Brisbane|Australia/Lindeman",
			"Australia/Brisbane|Australia/Queensland",
			"Australia/Darwin|Australia/North",
			"Australia/Lord_Howe|Australia/LHI",
			"Australia/Perth|Australia/West",
			"Australia/Sydney|Australia/ACT",
			"Australia/Sydney|Australia/Canberra",
			"Australia/Sydney|Australia/Currie",
			"Australia/Sydney|Australia/Hobart",
			"Australia/Sydney|Australia/Melbourne",
			"Australia/Sydney|Australia/NSW",
			"Australia/Sydney|Australia/Tasmania",
			"Australia/Sydney|Australia/Victoria",
			"Etc/UTC|Etc/UCT",
			"Etc/UTC|Etc/Universal",
			"Etc/UTC|Etc/Zulu",
			"Etc/UTC|UCT",
			"Etc/UTC|UTC",
			"Etc/UTC|Universal",
			"Etc/UTC|Zulu",
			"Europe/Athens|Asia/Nicosia",
			"Europe/Athens|EET",
			"Europe/Athens|Europe/Bucharest",
			"Europe/Athens|Europe/Helsinki",
			"Europe/Athens|Europe/Kiev",
			"Europe/Athens|Europe/Mariehamn",
			"Europe/Athens|Europe/Nicosia",
			"Europe/Athens|Europe/Riga",
			"Europe/Athens|Europe/Sofia",
			"Europe/Athens|Europe/Tallinn",
			"Europe/Athens|Europe/Uzhgorod",
			"Europe/Athens|Europe/Vilnius",
			"Europe/Athens|Europe/Zaporozhye",
			"Europe/Chisinau|Europe/Tiraspol",
			"Europe/Dublin|Eire",
			"Europe/Istanbul|Asia/Istanbul",
			"Europe/Istanbul|Turkey",
			"Europe/Lisbon|Atlantic/Canary",
			"Europe/Lisbon|Atlantic/Faeroe",
			"Europe/Lisbon|Atlantic/Faroe",
			"Europe/Lisbon|Atlantic/Madeira",
			"Europe/Lisbon|Portugal",
			"Europe/Lisbon|WET",
			"Europe/London|Europe/Belfast",
			"Europe/London|Europe/Guernsey",
			"Europe/London|Europe/Isle_of_Man",
			"Europe/London|Europe/Jersey",
			"Europe/London|GB",
			"Europe/London|GB-Eire",
			"Europe/Moscow|W-SU",
			"Europe/Paris|Africa/Ceuta",
			"Europe/Paris|Arctic/Longyearbyen",
			"Europe/Paris|Atlantic/Jan_Mayen",
			"Europe/Paris|CET",
			"Europe/Paris|Europe/Amsterdam",
			"Europe/Paris|Europe/Andorra",
			"Europe/Paris|Europe/Belgrade",
			"Europe/Paris|Europe/Berlin",
			"Europe/Paris|Europe/Bratislava",
			"Europe/Paris|Europe/Brussels",
			"Europe/Paris|Europe/Budapest",
			"Europe/Paris|Europe/Busingen",
			"Europe/Paris|Europe/Copenhagen",
			"Europe/Paris|Europe/Gibraltar",
			"Europe/Paris|Europe/Ljubljana",
			"Europe/Paris|Europe/Luxembourg",
			"Europe/Paris|Europe/Madrid",
			"Europe/Paris|Europe/Malta",
			"Europe/Paris|Europe/Monaco",
			"Europe/Paris|Europe/Oslo",
			"Europe/Paris|Europe/Podgorica",
			"Europe/Paris|Europe/Prague",
			"Europe/Paris|Europe/Rome",
			"Europe/Paris|Europe/San_Marino",
			"Europe/Paris|Europe/Sarajevo",
			"Europe/Paris|Europe/Skopje",
			"Europe/Paris|Europe/Stockholm",
			"Europe/Paris|Europe/Tirane",
			"Europe/Paris|Europe/Vaduz",
			"Europe/Paris|Europe/Vatican",
			"Europe/Paris|Europe/Vienna",
			"Europe/Paris|Europe/Warsaw",
			"Europe/Paris|Europe/Zagreb",
			"Europe/Paris|Europe/Zurich",
			"Europe/Paris|Poland",
			"Europe/Ulyanovsk|Europe/Astrakhan",
			"Pacific/Auckland|Antarctica/McMurdo",
			"Pacific/Auckland|Antarctica/South_Pole",
			"Pacific/Auckland|NZ",
			"Pacific/Chatham|NZ-CHAT",
			"Pacific/Easter|Chile/EasterIsland",
			"Pacific/Fakaofo|Etc/GMT-13",
			"Pacific/Fakaofo|Pacific/Enderbury",
			"Pacific/Galapagos|Etc/GMT+6",
			"Pacific/Gambier|Etc/GMT+9",
			"Pacific/Guadalcanal|Antarctica/Macquarie",
			"Pacific/Guadalcanal|Etc/GMT-11",
			"Pacific/Guadalcanal|Pacific/Efate",
			"Pacific/Guadalcanal|Pacific/Kosrae",
			"Pacific/Guadalcanal|Pacific/Noumea",
			"Pacific/Guadalcanal|Pacific/Pohnpei",
			"Pacific/Guadalcanal|Pacific/Ponape",
			"Pacific/Guam|Pacific/Saipan",
			"Pacific/Honolulu|HST",
			"Pacific/Honolulu|Pacific/Johnston",
			"Pacific/Honolulu|US/Hawaii",
			"Pacific/Kiritimati|Etc/GMT-14",
			"Pacific/Niue|Etc/GMT+11",
			"Pacific/Pago_Pago|Pacific/Midway",
			"Pacific/Pago_Pago|Pacific/Samoa",
			"Pacific/Pago_Pago|US/Samoa",
			"Pacific/Pitcairn|Etc/GMT+8",
			"Pacific/Port_Moresby|Antarctica/DumontDUrville",
			"Pacific/Port_Moresby|Etc/GMT-10",
			"Pacific/Port_Moresby|Pacific/Chuuk",
			"Pacific/Port_Moresby|Pacific/Truk",
			"Pacific/Port_Moresby|Pacific/Yap",
			"Pacific/Tahiti|Etc/GMT+10",
			"Pacific/Tahiti|Pacific/Rarotonga"
		]
	});


	return moment;
}));
//! moment.js locale configuration

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['../moment'], factory) :
   factory(global.moment)
}(this, (function (moment) { 'use strict';


    var he = moment.defineLocale('he', {
        months : 'ינואר_פברואר_מרץ_אפריל_מאי_יוני_יולי_אוגוסט_ספטמבר_אוקטובר_נובמבר_דצמבר'.split('_'),
        monthsShort : 'ינו׳_פבר׳_מרץ_אפר׳_מאי_יוני_יולי_אוג׳_ספט׳_אוק׳_נוב׳_דצמ׳'.split('_'),
        weekdays : 'ראשון_שני_שלישי_רביעי_חמישי_שישי_שבת'.split('_'),
        weekdaysShort : 'א׳_ב׳_ג׳_ד׳_ה׳_ו׳_ש׳'.split('_'),
        weekdaysMin : 'א_ב_ג_ד_ה_ו_ש'.split('_'),
        longDateFormat : {
            LT : 'HH:mm',
            LTS : 'HH:mm:ss',
            L : 'DD/MM/YYYY',
            LL : 'D [ב]MMMM YYYY',
            LLL : 'D [ב]MMMM YYYY HH:mm',
            LLLL : 'dddd, D [ב]MMMM YYYY HH:mm',
            l : 'D/M/YYYY',
            ll : 'D MMM YYYY',
            lll : 'D MMM YYYY HH:mm',
            llll : 'ddd, D MMM YYYY HH:mm'
        },
        calendar : {
            sameDay : '[היום ב־]LT',
            nextDay : '[מחר ב־]LT',
            nextWeek : 'dddd [בשעה] LT',
            lastDay : '[אתמול ב־]LT',
            lastWeek : '[ביום] dddd [האחרון בשעה] LT',
            sameElse : 'L'
        },
        relativeTime : {
            future : 'בעוד %s',
            past : 'לפני %s',
            s : 'מספר שניות',
            ss : '%d שניות',
            m : 'דקה',
            mm : '%d דקות',
            h : 'שעה',
            hh : function (number) {
                if (number === 2) {
                    return 'שעתיים';
                }
                return number + ' שעות';
            },
            d : 'יום',
            dd : function (number) {
                if (number === 2) {
                    return 'יומיים';
                }
                return number + ' ימים';
            },
            M : 'חודש',
            MM : function (number) {
                if (number === 2) {
                    return 'חודשיים';
                }
                return number + ' חודשים';
            },
            y : 'שנה',
            yy : function (number) {
                if (number === 2) {
                    return 'שנתיים';
                } else if (number % 10 === 0 && number !== 10) {
                    return number + ' שנה';
                }
                return number + ' שנים';
            }
        },
        meridiemParse: /אחה"צ|לפנה"צ|אחרי הצהריים|לפני הצהריים|לפנות בוקר|בבוקר|בערב/i,
        isPM : function (input) {
            return /^(אחה"צ|אחרי הצהריים|בערב)$/.test(input);
        },
        meridiem : function (hour, minute, isLower) {
            if (hour < 5) {
                return 'לפנות בוקר';
            } else if (hour < 10) {
                return 'בבוקר';
            } else if (hour < 12) {
                return isLower ? 'לפנה"צ' : 'לפני הצהריים';
            } else if (hour < 18) {
                return isLower ? 'אחה"צ' : 'אחרי הצהריים';
            } else {
                return 'בערב';
            }
        }
    });

    return he;

})));

// moment-timezone-localization for lang code: he

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['../moment'], factory) :
   factory(global.moment)
}(this, (function (moment) { 'use strict';


moment.tz.localizedNames = function() {
  return [{"value":"Africa/Abidjan","name":"אביג׳אן","id":"Africa/Abidjan"},{"value":"Africa/Accra","name":"אקרה","id":"Africa/Accra"},{"value":"Africa/Addis_Ababa","name":"אדיס אבבה","id":"Africa/Addis_Ababa"},{"value":"Africa/Algiers","name":"אלג׳יר","id":"Africa/Algiers"},{"value":"Africa/Asmera","name":"אסמרה","id":"Africa/Asmera"},{"value":"Africa/Bamako","name":"במאקו","id":"Africa/Bamako"},{"value":"Africa/Bangui","name":"בנגואי","id":"Africa/Bangui"},{"value":"Africa/Banjul","name":"בנג׳ול","id":"Africa/Banjul"},{"value":"Africa/Bissau","name":"ביסאו","id":"Africa/Bissau"},{"value":"Africa/Blantyre","name":"בלנטיר","id":"Africa/Blantyre"},{"value":"Africa/Brazzaville","name":"ברזוויל","id":"Africa/Brazzaville"},{"value":"Africa/Bujumbura","name":"בוג׳ומבורה","id":"Africa/Bujumbura"},{"value":"Africa/Cairo","name":"קהיר","id":"Africa/Cairo"},{"value":"Africa/Casablanca","name":"קזבלנקה","id":"Africa/Casablanca"},{"value":"Africa/Ceuta","name":"סאוטה","id":"Africa/Ceuta"},{"value":"Africa/Conakry","name":"קונאקרי","id":"Africa/Conakry"},{"value":"Africa/Dakar","name":"דקאר","id":"Africa/Dakar"},{"value":"Africa/Dar_es_Salaam","name":"דאר א-סלאם","id":"Africa/Dar_es_Salaam"},{"value":"Africa/Djibouti","name":"ג׳יבוטי","id":"Africa/Djibouti"},{"value":"Africa/Douala","name":"דואלה","id":"Africa/Douala"},{"value":"Africa/El_Aaiun","name":"אל עיון","id":"Africa/El_Aaiun"},{"value":"Africa/Freetown","name":"פריטאון","id":"Africa/Freetown"},{"value":"Africa/Gaborone","name":"גבורונה","id":"Africa/Gaborone"},{"value":"Africa/Harare","name":"הרארה","id":"Africa/Harare"},{"value":"Africa/Johannesburg","name":"יוהנסבורג","id":"Africa/Johannesburg"},{"value":"Africa/Juba","name":"ג׳ובה","id":"Africa/Juba"},{"value":"Africa/Kampala","name":"קמפאלה","id":"Africa/Kampala"},{"value":"Africa/Khartoum","name":"חרטום","id":"Africa/Khartoum"},{"value":"Africa/Kigali","name":"קיגלי","id":"Africa/Kigali"},{"value":"Africa/Kinshasa","name":"קינשסה","id":"Africa/Kinshasa"},{"value":"Africa/Lagos","name":"לגוס","id":"Africa/Lagos"},{"value":"Africa/Libreville","name":"ליברוויל","id":"Africa/Libreville"},{"value":"Africa/Lome","name":"לומה","id":"Africa/Lome"},{"value":"Africa/Luanda","name":"לואנדה","id":"Africa/Luanda"},{"value":"Africa/Lubumbashi","name":"לובומבאשי","id":"Africa/Lubumbashi"},{"value":"Africa/Lusaka","name":"לוסקה","id":"Africa/Lusaka"},{"value":"Africa/Malabo","name":"מלבו","id":"Africa/Malabo"},{"value":"Africa/Maputo","name":"מאפוטו","id":"Africa/Maputo"},{"value":"Africa/Maseru","name":"מסרו","id":"Africa/Maseru"},{"value":"Africa/Mbabane","name":"מבבנה","id":"Africa/Mbabane"},{"value":"Africa/Mogadishu","name":"מוגדישו","id":"Africa/Mogadishu"},{"value":"Africa/Monrovia","name":"מונרוביה","id":"Africa/Monrovia"},{"value":"Africa/Nairobi","name":"ניירובי","id":"Africa/Nairobi"},{"value":"Africa/Ndjamena","name":"נג׳מנה","id":"Africa/Ndjamena"},{"value":"Africa/Niamey","name":"ניאמיי","id":"Africa/Niamey"},{"value":"Africa/Nouakchott","name":"נואקצ׳וט","id":"Africa/Nouakchott"},{"value":"Africa/Ouagadougou","name":"וואגאדוגו","id":"Africa/Ouagadougou"},{"value":"Africa/Porto-Novo","name":"פורטו נובו","id":"Africa/Porto-Novo"},{"value":"Africa/Sao_Tome","name":"סאו טומה","id":"Africa/Sao_Tome"},{"value":"Africa/Tripoli","name":"טריפולי","id":"Africa/Tripoli"},{"value":"Africa/Tunis","name":"תוניס","id":"Africa/Tunis"},{"value":"Africa/Windhoek","name":"וינדהוק","id":"Africa/Windhoek"},{"value":"America/Adak","name":"אדאק","id":"America/Adak"},{"value":"America/Anchorage","name":"אנקורג׳","id":"America/Anchorage"},{"value":"America/Anguilla","name":"אנגווילה","id":"America/Anguilla"},{"value":"America/Antigua","name":"אנטיגואה","id":"America/Antigua"},{"value":"America/Araguaina","name":"אראגואינה","id":"America/Araguaina"},{"value":"America/Argentina/La_Rioja","name":"לה ריוחה","id":"America/Argentina/La_Rioja"},{"value":"America/Argentina/Rio_Gallegos","name":"ריו גאייגוס","id":"America/Argentina/Rio_Gallegos"},{"value":"America/Argentina/Salta","name":"סלטה","id":"America/Argentina/Salta"},{"value":"America/Argentina/San_Juan","name":"סן חואן","id":"America/Argentina/San_Juan"},{"value":"America/Argentina/San_Luis","name":"סן לואיס","id":"America/Argentina/San_Luis"},{"value":"America/Argentina/Tucuman","name":"טוקומן","id":"America/Argentina/Tucuman"},{"value":"America/Argentina/Ushuaia","name":"אושוואיה","id":"America/Argentina/Ushuaia"},{"value":"America/Aruba","name":"ארובה","id":"America/Aruba"},{"value":"America/Asuncion","name":"אסונסיון","id":"America/Asuncion"},{"value":"America/Bahia","name":"באהיה","id":"America/Bahia"},{"value":"America/Bahia_Banderas","name":"באהיה בנדרס","id":"America/Bahia_Banderas"},{"value":"America/Barbados","name":"ברבדוס","id":"America/Barbados"},{"value":"America/Belem","name":"בלם","id":"America/Belem"},{"value":"America/Belize","name":"בליז","id":"America/Belize"},{"value":"America/Blanc-Sablon","name":"בלאן-סבלון","id":"America/Blanc-Sablon"},{"value":"America/Boa_Vista","name":"בואה ויסטה","id":"America/Boa_Vista"},{"value":"America/Bogota","name":"בוגוטה","id":"America/Bogota"},{"value":"America/Boise","name":"בויסי","id":"America/Boise"},{"value":"America/Buenos_Aires","name":"בואנוס איירס","id":"America/Buenos_Aires"},{"value":"America/Cambridge_Bay","name":"קיימברידג׳ ביי","id":"America/Cambridge_Bay"},{"value":"America/Campo_Grande","name":"קמפו גרנדה","id":"America/Campo_Grande"},{"value":"America/Cancun","name":"קנקון","id":"America/Cancun"},{"value":"America/Caracas","name":"קראקס","id":"America/Caracas"},{"value":"America/Catamarca","name":"קטמרקה","id":"America/Catamarca"},{"value":"America/Cayenne","name":"קאיין","id":"America/Cayenne"},{"value":"America/Cayman","name":"קיימן","id":"America/Cayman"},{"value":"America/Chicago","name":"שיקגו","id":"America/Chicago"},{"value":"America/Chihuahua","name":"צ׳יוואווה","id":"America/Chihuahua"},{"value":"America/Coral_Harbour","name":"אטיקוקן","id":"America/Coral_Harbour"},{"value":"America/Cordoba","name":"קורדובה","id":"America/Cordoba"},{"value":"America/Costa_Rica","name":"קוסטה ריקה","id":"America/Costa_Rica"},{"value":"America/Creston","name":"קרסטון","id":"America/Creston"},{"value":"America/Cuiaba","name":"קויאבה","id":"America/Cuiaba"},{"value":"America/Curacao","name":"קוראסאו","id":"America/Curacao"},{"value":"America/Danmarkshavn","name":"דנמרקסהוון","id":"America/Danmarkshavn"},{"value":"America/Dawson","name":"דוסון","id":"America/Dawson"},{"value":"America/Dawson_Creek","name":"דוסון קריק","id":"America/Dawson_Creek"},{"value":"America/Denver","name":"דנוור","id":"America/Denver"},{"value":"America/Detroit","name":"דטרויט","id":"America/Detroit"},{"value":"America/Dominica","name":"דומיניקה","id":"America/Dominica"},{"value":"America/Edmonton","name":"אדמונטון","id":"America/Edmonton"},{"value":"America/Eirunepe","name":"אירונפי","id":"America/Eirunepe"},{"value":"America/El_Salvador","name":"אל סלבדור","id":"America/El_Salvador"},{"value":"America/Fort_Nelson","name":"פורט נלסון","id":"America/Fort_Nelson"},{"value":"America/Fortaleza","name":"פורטאלזה","id":"America/Fortaleza"},{"value":"America/Glace_Bay","name":"גלייס ביי","id":"America/Glace_Bay"},{"value":"America/Godthab","name":"נואוק","id":"America/Godthab"},{"value":"America/Goose_Bay","name":"גוס ביי","id":"America/Goose_Bay"},{"value":"America/Grand_Turk","name":"גרנד טורק","id":"America/Grand_Turk"},{"value":"America/Grenada","name":"גרנדה","id":"America/Grenada"},{"value":"America/Guadeloupe","name":"גואדלופ","id":"America/Guadeloupe"},{"value":"America/Guatemala","name":"גואטמלה","id":"America/Guatemala"},{"value":"America/Guayaquil","name":"גואיאקיל","id":"America/Guayaquil"},{"value":"America/Guyana","name":"גיאנה","id":"America/Guyana"},{"value":"America/Halifax","name":"הליפקס","id":"America/Halifax"},{"value":"America/Havana","name":"הוואנה","id":"America/Havana"},{"value":"America/Hermosillo","name":"הרמוסיו","id":"America/Hermosillo"},{"value":"America/Indiana/Knox","name":"נוקס, אינדיאנה","id":"America/Indiana/Knox"},{"value":"America/Indiana/Marengo","name":"מרנגו, אינדיאנה","id":"America/Indiana/Marengo"},{"value":"America/Indiana/Petersburg","name":"פיטרסבורג, אינדיאנה","id":"America/Indiana/Petersburg"},{"value":"America/Indiana/Tell_City","name":"טל סיטי, אינדיאנה","id":"America/Indiana/Tell_City"},{"value":"America/Indiana/Vevay","name":"ויוואיי, אינדיאנה","id":"America/Indiana/Vevay"},{"value":"America/Indiana/Vincennes","name":"וינסנס, אינדיאנה","id":"America/Indiana/Vincennes"},{"value":"America/Indiana/Winamac","name":"וינמאק, אינדיאנה","id":"America/Indiana/Winamac"},{"value":"America/Indianapolis","name":"אינדיאנפוליס","id":"America/Indianapolis"},{"value":"America/Inuvik","name":"אינוויק","id":"America/Inuvik"},{"value":"America/Iqaluit","name":"איקלואיט","id":"America/Iqaluit"},{"value":"America/Jamaica","name":"ג׳מייקה","id":"America/Jamaica"},{"value":"America/Jujuy","name":"חוחוי","id":"America/Jujuy"},{"value":"America/Juneau","name":"ג׳ונו","id":"America/Juneau"},{"value":"America/Kentucky/Monticello","name":"מונטיצ׳לו, קנטאקי","id":"America/Kentucky/Monticello"},{"value":"America/Kralendijk","name":"קרלנדייק","id":"America/Kralendijk"},{"value":"America/La_Paz","name":"לה פאס","id":"America/La_Paz"},{"value":"America/Lima","name":"לימה","id":"America/Lima"},{"value":"America/Los_Angeles","name":"לוס אנג׳לס","id":"America/Los_Angeles"},{"value":"America/Louisville","name":"לואיוויל","id":"America/Louisville"},{"value":"America/Lower_Princes","name":"לואוור פרינסס קוורטר","id":"America/Lower_Princes"},{"value":"America/Maceio","name":"מסייאו","id":"America/Maceio"},{"value":"America/Managua","name":"מנגואה","id":"America/Managua"},{"value":"America/Manaus","name":"מנאוס","id":"America/Manaus"},{"value":"America/Marigot","name":"מריגו","id":"America/Marigot"},{"value":"America/Martinique","name":"מרטיניק","id":"America/Martinique"},{"value":"America/Matamoros","name":"מטמורוס","id":"America/Matamoros"},{"value":"America/Mazatlan","name":"מזטלן","id":"America/Mazatlan"},{"value":"America/Mendoza","name":"מנדוזה","id":"America/Mendoza"},{"value":"America/Menominee","name":"מנומיני","id":"America/Menominee"},{"value":"America/Merida","name":"מרידה","id":"America/Merida"},{"value":"America/Metlakatla","name":"מטלקטלה","id":"America/Metlakatla"},{"value":"America/Mexico_City","name":"מקסיקו סיטי","id":"America/Mexico_City"},{"value":"America/Miquelon","name":"מיקלון","id":"America/Miquelon"},{"value":"America/Moncton","name":"מונקטון","id":"America/Moncton"},{"value":"America/Monterrey","name":"מונטריי","id":"America/Monterrey"},{"value":"America/Montevideo","name":"מונטווידאו","id":"America/Montevideo"},{"value":"America/Montserrat","name":"מונסראט","id":"America/Montserrat"},{"value":"America/Nassau","name":"נסאו","id":"America/Nassau"},{"value":"America/New_York","name":"ניו יורק","id":"America/New_York"},{"value":"America/Nipigon","name":"ניפיגון","id":"America/Nipigon"},{"value":"America/Nome","name":"נום","id":"America/Nome"},{"value":"America/Noronha","name":"נורוניה","id":"America/Noronha"},{"value":"America/North_Dakota/Beulah","name":"ביולה, צפון דקוטה","id":"America/North_Dakota/Beulah"},{"value":"America/North_Dakota/Center","name":"סנטר, צפון דקוטה","id":"America/North_Dakota/Center"},{"value":"America/North_Dakota/New_Salem","name":"ניו סיילם, צפון דקוטה","id":"America/North_Dakota/New_Salem"},{"value":"America/Ojinaga","name":"אוג׳ינאגה","id":"America/Ojinaga"},{"value":"America/Panama","name":"פנמה","id":"America/Panama"},{"value":"America/Pangnirtung","name":"פנגנירטונג","id":"America/Pangnirtung"},{"value":"America/Paramaribo","name":"פרמריבו","id":"America/Paramaribo"},{"value":"America/Phoenix","name":"פיניקס","id":"America/Phoenix"},{"value":"America/Port-au-Prince","name":"פורט או פראנס","id":"America/Port-au-Prince"},{"value":"America/Port_of_Spain","name":"פורט אוף ספיין","id":"America/Port_of_Spain"},{"value":"America/Porto_Velho","name":"פורטו וליו","id":"America/Porto_Velho"},{"value":"America/Puerto_Rico","name":"פוארטו ריקו","id":"America/Puerto_Rico"},{"value":"America/Punta_Arenas","name":"פונטה ארנס","id":"America/Punta_Arenas"},{"value":"America/Rainy_River","name":"רייני ריבר","id":"America/Rainy_River"},{"value":"America/Rankin_Inlet","name":"רנקין אינלט","id":"America/Rankin_Inlet"},{"value":"America/Recife","name":"רסיפה","id":"America/Recife"},{"value":"America/Regina","name":"רג׳ינה","id":"America/Regina"},{"value":"America/Resolute","name":"רזולוט","id":"America/Resolute"},{"value":"America/Rio_Branco","name":"ריו ברנקו","id":"America/Rio_Branco"},{"value":"America/Santa_Isabel","name":"סנטה איזבל","id":"America/Santa_Isabel"},{"value":"America/Santarem","name":"סנטרם","id":"America/Santarem"},{"value":"America/Santiago","name":"סנטיאגו","id":"America/Santiago"},{"value":"America/Santo_Domingo","name":"סנטו דומינגו","id":"America/Santo_Domingo"},{"value":"America/Sao_Paulo","name":"סאו פאולו","id":"America/Sao_Paulo"},{"value":"America/Scoresbysund","name":"סקורסביסונד","id":"America/Scoresbysund"},{"value":"America/Sitka","name":"סיטקה","id":"America/Sitka"},{"value":"America/St_Barthelemy","name":"סנט ברתלמי","id":"America/St_Barthelemy"},{"value":"America/St_Johns","name":"סנט ג׳ונס","id":"America/St_Johns"},{"value":"America/St_Kitts","name":"סנט קיטס","id":"America/St_Kitts"},{"value":"America/St_Lucia","name":"סנט לוסיה","id":"America/St_Lucia"},{"value":"America/St_Thomas","name":"סנט תומאס","id":"America/St_Thomas"},{"value":"America/St_Vincent","name":"סנט וינסנט","id":"America/St_Vincent"},{"value":"America/Swift_Current","name":"סוויפט קרנט","id":"America/Swift_Current"},{"value":"America/Tegucigalpa","name":"טגוסיגלפה","id":"America/Tegucigalpa"},{"value":"America/Thule","name":"תולה","id":"America/Thule"},{"value":"America/Thunder_Bay","name":"ת׳אנדר ביי","id":"America/Thunder_Bay"},{"value":"America/Tijuana","name":"טיחואנה","id":"America/Tijuana"},{"value":"America/Toronto","name":"טורונטו","id":"America/Toronto"},{"value":"America/Tortola","name":"טורטולה","id":"America/Tortola"},{"value":"America/Vancouver","name":"ונקובר","id":"America/Vancouver"},{"value":"America/Whitehorse","name":"ווייטהורס","id":"America/Whitehorse"},{"value":"America/Winnipeg","name":"וויניפג","id":"America/Winnipeg"},{"value":"America/Yakutat","name":"יקוטאט","id":"America/Yakutat"},{"value":"America/Yellowknife","name":"ילונייף","id":"America/Yellowknife"},{"value":"Antarctica/Casey","name":"קאסיי","id":"Antarctica/Casey"},{"value":"Antarctica/Davis","name":"דיוויס","id":"Antarctica/Davis"},{"value":"Antarctica/DumontDUrville","name":"דומון ד׳אורוויל","id":"Antarctica/DumontDUrville"},{"value":"Antarctica/Macquarie","name":"מקרי","id":"Antarctica/Macquarie"},{"value":"Antarctica/Mawson","name":"מוסון","id":"Antarctica/Mawson"},{"value":"Antarctica/McMurdo","name":"מק-מרדו","id":"Antarctica/McMurdo"},{"value":"Antarctica/Palmer","name":"פאלמר","id":"Antarctica/Palmer"},{"value":"Antarctica/Rothera","name":"רות׳רה","id":"Antarctica/Rothera"},{"value":"Antarctica/Syowa","name":"סיוואה","id":"Antarctica/Syowa"},{"value":"Antarctica/Troll","name":"טרול","id":"Antarctica/Troll"},{"value":"Antarctica/Vostok","name":"ווסטוק","id":"Antarctica/Vostok"},{"value":"Arctic/Longyearbyen","name":"לונגיירבין","id":"Arctic/Longyearbyen"},{"value":"Asia/Aden","name":"עדן","id":"Asia/Aden"},{"value":"Asia/Almaty","name":"אלמאטי","id":"Asia/Almaty"},{"value":"Asia/Amman","name":"עמאן","id":"Asia/Amman"},{"value":"Asia/Anadyr","name":"אנדיר","id":"Asia/Anadyr"},{"value":"Asia/Aqtau","name":"אקטאו","id":"Asia/Aqtau"},{"value":"Asia/Aqtobe","name":"אקטובה","id":"Asia/Aqtobe"},{"value":"Asia/Ashgabat","name":"אשגבט","id":"Asia/Ashgabat"},{"value":"Asia/Atyrau","name":"אטיראו","id":"Asia/Atyrau"},{"value":"Asia/Baghdad","name":"בגדד","id":"Asia/Baghdad"},{"value":"Asia/Bahrain","name":"בחריין","id":"Asia/Bahrain"},{"value":"Asia/Baku","name":"באקו","id":"Asia/Baku"},{"value":"Asia/Bangkok","name":"בנגקוק","id":"Asia/Bangkok"},{"value":"Asia/Barnaul","name":"ברנאול","id":"Asia/Barnaul"},{"value":"Asia/Beirut","name":"ביירות","id":"Asia/Beirut"},{"value":"Asia/Bishkek","name":"בישקק","id":"Asia/Bishkek"},{"value":"Asia/Brunei","name":"ברוניי","id":"Asia/Brunei"},{"value":"Asia/Calcutta","name":"קולקטה","id":"Asia/Calcutta"},{"value":"Asia/Chita","name":"צ׳יטה","id":"Asia/Chita"},{"value":"Asia/Choibalsan","name":"צ׳ויבלסן","id":"Asia/Choibalsan"},{"value":"Asia/Colombo","name":"קולומבו","id":"Asia/Colombo"},{"value":"Asia/Damascus","name":"דמשק","id":"Asia/Damascus"},{"value":"Asia/Dhaka","name":"דאקה","id":"Asia/Dhaka"},{"value":"Asia/Dili","name":"דילי","id":"Asia/Dili"},{"value":"Asia/Dubai","name":"דובאי","id":"Asia/Dubai"},{"value":"Asia/Dushanbe","name":"דושנבה","id":"Asia/Dushanbe"},{"value":"Asia/Famagusta","name":"פמגוסטה","id":"Asia/Famagusta"},{"value":"Asia/Gaza","name":"עזה","id":"Asia/Gaza"},{"value":"Asia/Hebron","name":"חברון","id":"Asia/Hebron"},{"value":"Asia/Hong_Kong","name":"הונג קונג","id":"Asia/Hong_Kong"},{"value":"Asia/Hovd","name":"חובד","id":"Asia/Hovd"},{"value":"Asia/Irkutsk","name":"אירקוטסק","id":"Asia/Irkutsk"},{"value":"Asia/Jakarta","name":"ג׳קרטה","id":"Asia/Jakarta"},{"value":"Asia/Jayapura","name":"ג׳איאפורה","id":"Asia/Jayapura"},{"value":"Asia/Jerusalem","name":"ירושלים","id":"Asia/Jerusalem"},{"value":"Asia/Kabul","name":"קאבול","id":"Asia/Kabul"},{"value":"Asia/Kamchatka","name":"קמצ׳טקה","id":"Asia/Kamchatka"},{"value":"Asia/Karachi","name":"קראצ׳י","id":"Asia/Karachi"},{"value":"Asia/Katmandu","name":"קטמנדו","id":"Asia/Katmandu"},{"value":"Asia/Khandyga","name":"חנדיגה","id":"Asia/Khandyga"},{"value":"Asia/Krasnoyarsk","name":"קרסנויארסק","id":"Asia/Krasnoyarsk"},{"value":"Asia/Kuala_Lumpur","name":"קואלה לומפור","id":"Asia/Kuala_Lumpur"},{"value":"Asia/Kuching","name":"קוצ׳ינג","id":"Asia/Kuching"},{"value":"Asia/Kuwait","name":"כווית","id":"Asia/Kuwait"},{"value":"Asia/Macau","name":"מקאו","id":"Asia/Macau"},{"value":"Asia/Magadan","name":"מגדן","id":"Asia/Magadan"},{"value":"Asia/Makassar","name":"מאקאסאר","id":"Asia/Makassar"},{"value":"Asia/Manila","name":"מנילה","id":"Asia/Manila"},{"value":"Asia/Muscat","name":"מוסקט","id":"Asia/Muscat"},{"value":"Asia/Nicosia","name":"ניקוסיה","id":"Asia/Nicosia"},{"value":"Asia/Novokuznetsk","name":"נובוקוזנטסק","id":"Asia/Novokuznetsk"},{"value":"Asia/Novosibirsk","name":"נובוסיבירסק","id":"Asia/Novosibirsk"},{"value":"Asia/Omsk","name":"אומסק","id":"Asia/Omsk"},{"value":"Asia/Oral","name":"אורל","id":"Asia/Oral"},{"value":"Asia/Phnom_Penh","name":"פנום פן","id":"Asia/Phnom_Penh"},{"value":"Asia/Pontianak","name":"פונטיאנק","id":"Asia/Pontianak"},{"value":"Asia/Pyongyang","name":"פיונגיאנג","id":"Asia/Pyongyang"},{"value":"Asia/Qatar","name":"קטאר","id":"Asia/Qatar"},{"value":"Asia/Qyzylorda","name":"קיזילורדה","id":"Asia/Qyzylorda"},{"value":"Asia/Rangoon","name":"רנגון","id":"Asia/Rangoon"},{"value":"Asia/Riyadh","name":"ריאד","id":"Asia/Riyadh"},{"value":"Asia/Saigon","name":"הו צ׳י מין סיטי","id":"Asia/Saigon"},{"value":"Asia/Sakhalin","name":"סחלין","id":"Asia/Sakhalin"},{"value":"Asia/Samarkand","name":"סמרקנד","id":"Asia/Samarkand"},{"value":"Asia/Seoul","name":"סיאול","id":"Asia/Seoul"},{"value":"Asia/Shanghai","name":"שנחאי","id":"Asia/Shanghai"},{"value":"Asia/Singapore","name":"סינגפור","id":"Asia/Singapore"},{"value":"Asia/Srednekolymsk","name":"סרדנייקולימסק","id":"Asia/Srednekolymsk"},{"value":"Asia/Taipei","name":"טאיפיי","id":"Asia/Taipei"},{"value":"Asia/Tashkent","name":"טשקנט","id":"Asia/Tashkent"},{"value":"Asia/Tbilisi","name":"טביליסי","id":"Asia/Tbilisi"},{"value":"Asia/Tehran","name":"טהרן","id":"Asia/Tehran"},{"value":"Asia/Thimphu","name":"טהימפהו","id":"Asia/Thimphu"},{"value":"Asia/Tokyo","name":"טוקיו","id":"Asia/Tokyo"},{"value":"Asia/Tomsk","name":"טומסק","id":"Asia/Tomsk"},{"value":"Asia/Ulaanbaatar","name":"אולאאנבטאר","id":"Asia/Ulaanbaatar"},{"value":"Asia/Urumqi","name":"אורומקי","id":"Asia/Urumqi"},{"value":"Asia/Ust-Nera","name":"אוסט-נרה","id":"Asia/Ust-Nera"},{"value":"Asia/Vientiane","name":"האנוי","id":"Asia/Vientiane"},{"value":"Asia/Vladivostok","name":"ולדיווסטוק","id":"Asia/Vladivostok"},{"value":"Asia/Yakutsk","name":"יקוטסק","id":"Asia/Yakutsk"},{"value":"Asia/Yekaterinburg","name":"יקטרינבורג","id":"Asia/Yekaterinburg"},{"value":"Asia/Yerevan","name":"ירוואן","id":"Asia/Yerevan"},{"value":"Atlantic/Azores","name":"האיים האזוריים","id":"Atlantic/Azores"},{"value":"Atlantic/Bermuda","name":"ברמודה","id":"Atlantic/Bermuda"},{"value":"Atlantic/Canary","name":"האיים הקנריים","id":"Atlantic/Canary"},{"value":"Atlantic/Cape_Verde","name":"כף ורדה","id":"Atlantic/Cape_Verde"},{"value":"Atlantic/Faeroe","name":"פארו","id":"Atlantic/Faeroe"},{"value":"Atlantic/Madeira","name":"מדיירה","id":"Atlantic/Madeira"},{"value":"Atlantic/Reykjavik","name":"רייקיאוויק","id":"Atlantic/Reykjavik"},{"value":"Atlantic/South_Georgia","name":"דרום ג׳ורג׳יה","id":"Atlantic/South_Georgia"},{"value":"Atlantic/St_Helena","name":"סנט הלנה","id":"Atlantic/St_Helena"},{"value":"Atlantic/Stanley","name":"סטנלי","id":"Atlantic/Stanley"},{"value":"Australia/Adelaide","name":"אדלייד","id":"Australia/Adelaide"},{"value":"Australia/Brisbane","name":"בריסביין","id":"Australia/Brisbane"},{"value":"Australia/Broken_Hill","name":"ברוקן היל","id":"Australia/Broken_Hill"},{"value":"Australia/Currie","name":"קרי","id":"Australia/Currie"},{"value":"Australia/Darwin","name":"דרווין","id":"Australia/Darwin"},{"value":"Australia/Eucla","name":"יוקלה","id":"Australia/Eucla"},{"value":"Australia/Hobart","name":"הוברט","id":"Australia/Hobart"},{"value":"Australia/Lindeman","name":"לינדמן","id":"Australia/Lindeman"},{"value":"Australia/Lord_Howe","name":"אי הלורד האו","id":"Australia/Lord_Howe"},{"value":"Australia/Melbourne","name":"מלבורן","id":"Australia/Melbourne"},{"value":"Australia/Perth","name":"פרת׳","id":"Australia/Perth"},{"value":"Australia/Sydney","name":"סידני","id":"Australia/Sydney"},{"value":"Etc/UTC","name":"זמן אוניברסלי מתואם","id":"Etc/UTC"},{"value":"Europe/Amsterdam","name":"אמסטרדם","id":"Europe/Amsterdam"},{"value":"Europe/Andorra","name":"אנדורה","id":"Europe/Andorra"},{"value":"Europe/Astrakhan","name":"אסטרחן","id":"Europe/Astrakhan"},{"value":"Europe/Athens","name":"אתונה","id":"Europe/Athens"},{"value":"Europe/Belgrade","name":"בלגרד","id":"Europe/Belgrade"},{"value":"Europe/Berlin","name":"ברלין","id":"Europe/Berlin"},{"value":"Europe/Bratislava","name":"ברטיסלבה","id":"Europe/Bratislava"},{"value":"Europe/Brussels","name":"בריסל","id":"Europe/Brussels"},{"value":"Europe/Bucharest","name":"בוקרשט","id":"Europe/Bucharest"},{"value":"Europe/Budapest","name":"בודפשט","id":"Europe/Budapest"},{"value":"Europe/Busingen","name":"ביזינגן","id":"Europe/Busingen"},{"value":"Europe/Chisinau","name":"קישינב","id":"Europe/Chisinau"},{"value":"Europe/Copenhagen","name":"קופנהגן","id":"Europe/Copenhagen"},{"value":"Europe/Dublin","name":"שעון קיץ אירלנדדבלין","id":"Europe/Dublin"},{"value":"Europe/Gibraltar","name":"גיברלטר","id":"Europe/Gibraltar"},{"value":"Europe/Guernsey","name":"גרנזי","id":"Europe/Guernsey"},{"value":"Europe/Helsinki","name":"הלסינקי","id":"Europe/Helsinki"},{"value":"Europe/Isle_of_Man","name":"האי מאן","id":"Europe/Isle_of_Man"},{"value":"Europe/Istanbul","name":"איסטנבול","id":"Europe/Istanbul"},{"value":"Europe/Jersey","name":"ג׳רזי","id":"Europe/Jersey"},{"value":"Europe/Kaliningrad","name":"קלינינגרד","id":"Europe/Kaliningrad"},{"value":"Europe/Kiev","name":"קייב","id":"Europe/Kiev"},{"value":"Europe/Kirov","name":"קירוב","id":"Europe/Kirov"},{"value":"Europe/Lisbon","name":"ליסבון","id":"Europe/Lisbon"},{"value":"Europe/Ljubljana","name":"לובליאנה","id":"Europe/Ljubljana"},{"value":"Europe/London","name":"שעון קיץ בריטניהלונדון","id":"Europe/London"},{"value":"Europe/Luxembourg","name":"לוקסמבורג","id":"Europe/Luxembourg"},{"value":"Europe/Madrid","name":"מדריד","id":"Europe/Madrid"},{"value":"Europe/Malta","name":"מלטה","id":"Europe/Malta"},{"value":"Europe/Mariehamn","name":"מרייהאמן","id":"Europe/Mariehamn"},{"value":"Europe/Minsk","name":"מינסק","id":"Europe/Minsk"},{"value":"Europe/Monaco","name":"מונקו","id":"Europe/Monaco"},{"value":"Europe/Moscow","name":"מוסקבה","id":"Europe/Moscow"},{"value":"Europe/Oslo","name":"אוסלו","id":"Europe/Oslo"},{"value":"Europe/Paris","name":"פריז","id":"Europe/Paris"},{"value":"Europe/Podgorica","name":"פודגוריצה","id":"Europe/Podgorica"},{"value":"Europe/Prague","name":"פראג","id":"Europe/Prague"},{"value":"Europe/Riga","name":"ריגה","id":"Europe/Riga"},{"value":"Europe/Rome","name":"רומא","id":"Europe/Rome"},{"value":"Europe/Samara","name":"סמרה","id":"Europe/Samara"},{"value":"Europe/San_Marino","name":"סן מרינו","id":"Europe/San_Marino"},{"value":"Europe/Sarajevo","name":"סרייבו","id":"Europe/Sarajevo"},{"value":"Europe/Saratov","name":"סראטוב","id":"Europe/Saratov"},{"value":"Europe/Simferopol","name":"סימפרופול","id":"Europe/Simferopol"},{"value":"Europe/Skopje","name":"סקופיה","id":"Europe/Skopje"},{"value":"Europe/Sofia","name":"סופיה","id":"Europe/Sofia"},{"value":"Europe/Stockholm","name":"שטוקהולם","id":"Europe/Stockholm"},{"value":"Europe/Tallinn","name":"טאלין","id":"Europe/Tallinn"},{"value":"Europe/Tirane","name":"טירנה","id":"Europe/Tirane"},{"value":"Europe/Ulyanovsk","name":"אוליאנובסק","id":"Europe/Ulyanovsk"},{"value":"Europe/Uzhgorod","name":"אוז׳הורוד","id":"Europe/Uzhgorod"},{"value":"Europe/Vaduz","name":"ואדוץ","id":"Europe/Vaduz"},{"value":"Europe/Vatican","name":"הוותיקן","id":"Europe/Vatican"},{"value":"Europe/Vienna","name":"וינה","id":"Europe/Vienna"},{"value":"Europe/Vilnius","name":"וילנה","id":"Europe/Vilnius"},{"value":"Europe/Volgograd","name":"וולגוגרד","id":"Europe/Volgograd"},{"value":"Europe/Warsaw","name":"ורשה","id":"Europe/Warsaw"},{"value":"Europe/Zagreb","name":"זאגרב","id":"Europe/Zagreb"},{"value":"Europe/Zaporozhye","name":"זפורוז׳יה","id":"Europe/Zaporozhye"},{"value":"Europe/Zurich","name":"ציריך","id":"Europe/Zurich"},{"value":"Indian/Antananarivo","name":"אנטננריבו","id":"Indian/Antananarivo"},{"value":"Indian/Chagos","name":"צ׳אגוס","id":"Indian/Chagos"},{"value":"Indian/Christmas","name":"האי כריסטמס","id":"Indian/Christmas"},{"value":"Indian/Cocos","name":"קוקוס","id":"Indian/Cocos"},{"value":"Indian/Comoro","name":"קומורו","id":"Indian/Comoro"},{"value":"Indian/Kerguelen","name":"קרגוולן","id":"Indian/Kerguelen"},{"value":"Indian/Mahe","name":"מהא","id":"Indian/Mahe"},{"value":"Indian/Maldives","name":"האיים המלדיביים","id":"Indian/Maldives"},{"value":"Indian/Mauritius","name":"מאוריציוס","id":"Indian/Mauritius"},{"value":"Indian/Mayotte","name":"מאיוט","id":"Indian/Mayotte"},{"value":"Indian/Reunion","name":"ראוניון","id":"Indian/Reunion"},{"value":"Pacific/Apia","name":"אפיה","id":"Pacific/Apia"},{"value":"Pacific/Auckland","name":"אוקלנד","id":"Pacific/Auckland"},{"value":"Pacific/Bougainville","name":"בוגנוויל","id":"Pacific/Bougainville"},{"value":"Pacific/Chatham","name":"צ׳אטהאם","id":"Pacific/Chatham"},{"value":"Pacific/Easter","name":"אי הפסחא","id":"Pacific/Easter"},{"value":"Pacific/Efate","name":"אפטה","id":"Pacific/Efate"},{"value":"Pacific/Enderbury","name":"אנדרבורי","id":"Pacific/Enderbury"},{"value":"Pacific/Fakaofo","name":"פקאופו","id":"Pacific/Fakaofo"},{"value":"Pacific/Fiji","name":"פיג׳י","id":"Pacific/Fiji"},{"value":"Pacific/Funafuti","name":"פונפוטי","id":"Pacific/Funafuti"},{"value":"Pacific/Galapagos","name":"גלפאגוס","id":"Pacific/Galapagos"},{"value":"Pacific/Gambier","name":"איי גמבייה","id":"Pacific/Gambier"},{"value":"Pacific/Guadalcanal","name":"גוודלקנאל","id":"Pacific/Guadalcanal"},{"value":"Pacific/Guam","name":"גואם","id":"Pacific/Guam"},{"value":"Pacific/Honolulu","name":"הונולולו","id":"Pacific/Honolulu"},{"value":"Pacific/Johnston","name":"ג׳ונסטון","id":"Pacific/Johnston"},{"value":"Pacific/Kiritimati","name":"קיריטימאטי","id":"Pacific/Kiritimati"},{"value":"Pacific/Kosrae","name":"קוסרה","id":"Pacific/Kosrae"},{"value":"Pacific/Kwajalein","name":"קוואג׳ליין","id":"Pacific/Kwajalein"},{"value":"Pacific/Majuro","name":"מאג׳ורו","id":"Pacific/Majuro"},{"value":"Pacific/Marquesas","name":"איי מרקיז","id":"Pacific/Marquesas"},{"value":"Pacific/Midway","name":"מידוויי","id":"Pacific/Midway"},{"value":"Pacific/Nauru","name":"נאורו","id":"Pacific/Nauru"},{"value":"Pacific/Niue","name":"ניואה","id":"Pacific/Niue"},{"value":"Pacific/Norfolk","name":"נורפוק","id":"Pacific/Norfolk"},{"value":"Pacific/Noumea","name":"נומאה","id":"Pacific/Noumea"},{"value":"Pacific/Pago_Pago","name":"פאגו פאגו","id":"Pacific/Pago_Pago"},{"value":"Pacific/Palau","name":"פלאו","id":"Pacific/Palau"},{"value":"Pacific/Pitcairn","name":"פיטקרן","id":"Pacific/Pitcairn"},{"value":"Pacific/Ponape","name":"פונפיי","id":"Pacific/Ponape"},{"value":"Pacific/Port_Moresby","name":"פורט מורסבי","id":"Pacific/Port_Moresby"},{"value":"Pacific/Rarotonga","name":"רארוטונגה","id":"Pacific/Rarotonga"},{"value":"Pacific/Saipan","name":"סאיפאן","id":"Pacific/Saipan"},{"value":"Pacific/Tahiti","name":"טהיטי","id":"Pacific/Tahiti"},{"value":"Pacific/Tarawa","name":"טאראווה","id":"Pacific/Tarawa"},{"value":"Pacific/Tongatapu","name":"טונגטאפו","id":"Pacific/Tongatapu"},{"value":"Pacific/Truk","name":"צ׳וק","id":"Pacific/Truk"},{"value":"Pacific/Wake","name":"וייק","id":"Pacific/Wake"},{"value":"Pacific/Wallis","name":"ווליס","id":"Pacific/Wallis"}];
};

return moment;
})));

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM YYYY'); };
moment.fn.longDate = function(){ return this.format('D MMMM YYYY LT'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
