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
I18n._compiledMFs = {"topic.read_more_MF" : function(d){
var r = "";
r += "Có ";
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
r += "is <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>1 unread</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "are <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " unread</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["vi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "and ";
return r;
},
"false" : function(d){
var r = "";
r += "is ";
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
r += "/new'>1 new</a> topic";
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
r += "and ";
return r;
},
"false" : function(d){
var r = "";
r += "are ";
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
})() + " new</a> topics";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["vi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " remaining, or ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "browse other topics in ";
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
}, "posts_likes_MF" : function(d){
var r = "";
r += "\nChủ đề này có ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 reply";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " replies";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["vi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "ratio";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"low" : function(d){
var r = "";
r += "with a high like to post ratio";
return r;
},
"med" : function(d){
var r = "";
r += "with a very high like to post ratio";
return r;
},
"high" : function(d){
var r = "";
r += "with an extremely high like to post ratio";
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
}, "too_few_topics_and_posts_notice_MF" : function(d){
var r = "";
r += "让我们<a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">开始讨论吧！</a>现";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "仅有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "共有 <strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["vi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "和";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["vi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。访客需要更多的阅读和回复——我们建议至少 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["vi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "和";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["vi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。此消息仅管理人员可见。";
return r;
}, "too_few_topics_notice_MF" : function(d){
var r = "";
r += "让我们<a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">开始讨论吧！</a>现";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "仅有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "共有 <strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["vi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。访客需要更多的阅读和回复——我们建议至少";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["vi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。此消息仅管理人员可见。";
return r;
}, "too_few_posts_notice_MF" : function(d){
var r = "";
r += "让我们<a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">开始讨论吧！</a>现 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "仅有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "共有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["vi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。访客需要更多的阅读和回复——我们建议至少";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["vi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。此消息仅管理人员可见。";
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
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/hour";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/hour";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["vi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a>达到了站点设置中的限制";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/hour";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/hour";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["vi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。";
return r;
}, "logs_error_rate_notice.reached_minute_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b>1 – <a href='";
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
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/minute";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/minute";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["vi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a>已经达到站点设置限制 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/minute";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/minute";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["vi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。";
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
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/hour";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/hour";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["vi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a>超出了站点设置中的限制";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/hour";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/hour";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["vi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。";
return r;
}, "logs_error_rate_notice.exceeded_minute_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b>1 – <a href='";
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
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/minute";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/minute";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["vi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a>已经超出站点设置限制 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/minute";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/minute";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["vi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。";
return r;
}, "topic.bumped_at_title_MF" : function(){ return "Invalid Format: Uncaught SyntaxError: Expected [a-zA-Z$_] but \"%u9996\" found. at undefined:1376:10";}, "flagging.delete_confirm_MF" : function(d){
var r = "";
r += "你将删除该用户的";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["vi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " and ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["vi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "、该账户，并阻止其IP地址 <b>%";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["ip_address"];
r += "</b> 再次注册，并将其邮件地址 <b>%";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["email"];
r += "</b> 加入黑名单。你确定这用户是广告散布者吗？";
return r;
}, "admin.user.delete_all_posts_confirm_MF" : function(d){
var r = "";
r += "你将要删除 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " 个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["vi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "和 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 个主题";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " 个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["vi"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。确定吗？";
return r;
}};
MessageFormat.locale.vi = function ( n ) {
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

I18n.translations = {"vi":{"js":{"number":{"format":{"separator":".","delimiter":","},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"other":"Bytes"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}},"short":{"thousands":"{{number}}k","millions":"{{number}}M"}},"dates":{"time":"HH:mm","time_with_zone":"HH:mm (z)","time_short_day":"ddd, HH:mm","timeline_date":"MMM YYYY","long_no_year_no_time":"D MMM","full_no_year_no_time":"Do MMMM","long_with_year":"D MMM YYYY HH:mm","long_with_year_no_time":"D MMM YYYY","full_with_year_no_time":"D MMMM YYYY","long_date_with_year":"D MMM 'YY LT","long_date_without_year":"D MMM LT","long_date_with_year_without_time":"D MMM 'YY","long_date_without_year_with_linebreak":"D MMM \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"D MMM 'YY \u003cbr/\u003eLT","wrap_ago":"%{date} ngày trước","tiny":{"half_a_minute":"\u003c 1 phút","less_than_x_seconds":{"other":"\u003c %{count}giây"},"x_seconds":{"other":"%{count}giây"},"less_than_x_minutes":{"other":"\u003c %{count} phút"},"x_minutes":{"other":"%{count}phút"},"about_x_hours":{"other":"%{count}giờ"},"x_days":{"other":"%{count}ngày"},"x_months":{"other":"%{count} tháng"},"about_x_years":{"other":"%{count}năm"},"over_x_years":{"other":"\u003e %{count}năm"},"almost_x_years":{"other":"%{count}năm"},"date_month":"D MMM","date_year":"MMM 'YY"},"medium":{"x_minutes":{"other":"%{count} phút"},"x_hours":{"other":"%{count} giờ"},"x_days":{"other":"%{count} ngày"},"date_year":"D MMM 'YY"},"medium_with_ago":{"x_minutes":{"other":" %{count} phút trước"},"x_hours":{"other":"%{count} giờ trước"},"x_days":{"other":"%{count} ngày trước"},"x_months":{"other":"%{count}tháng trước"},"x_years":{"other":"%{count}năm trước"}},"later":{"x_days":{"other":"còn %{count} ngày"},"x_months":{"other":"còn %{count} tháng"},"x_years":{"other":"còn %{count} năm"}},"previous_month":"Tháng trước","next_month":"Tháng sau","placeholder":"ngày"},"share":{"topic_html":"Chủ đề:\u003cspan class=\"topic-title\"\u003e%{topicTitle}\u003c/span\u003e","post":"đăng #%{postNumber}","close":"đóng","twitter":"chia sẻ liên kết này lên Twitter","facebook":"chia sẻ liên kết này lên Facebook","email":"Gửi liên kết này trong một email"},"action_codes":{"public_topic":"hiển thị chủ đề này công khai lúc %{when}","private_topic":"tạo một tin nhắn từ chủ đề này %{when}","split_topic":"tách chủ đề này lúc %{when}","invited_user":"đã mời %{who} lúc %{when}","invited_group":"đã mời %{who} lúc %{when}","user_left":"%{who}đã tự xóa mình khỏi tin nhắn này lúc %{when}","removed_user":"đã xoá %{who} lúc %{when}","removed_group":"đã xoá %{who} lúc %{when}","autobumped":"tự động đẩy lúc%{when}","autoclosed":{"enabled":"bị đóng lúc %{when}","disabled":"được mở lúc %{when}"},"closed":{"enabled":"bị đóng lúc %{when}","disabled":"được mở lúc %{when}"},"archived":{"enabled":"được đưa vào lưu trữ lúc %{when}","disabled":"được đưa ra khỏi lưu trữ lúc %{when}"},"pinned":{"enabled":"được ghim lúc %{when}","disabled":"được bỏ ghim lúc %{when}"},"pinned_globally":{"enabled":"được ghim lên toàn trang lúc %{when}","disabled":"được bỏ ghim lúc %{when}"},"visible":{"enabled":"được liệt kê lúc %{when}","disabled":"được bỏ liệt kê lúc %{when}"},"banner":{"enabled":"chọn đây làm banner lúc %{when}. Nó sẽ xuất hiện ở đầu mỗi trang cho đến khi bị ẩn đi bởi người dùng.","disabled":"xoá banner này lúc %{when}. Nó sẽ không còn xuất hiện ở đầu mỗi trang."}},"topic_admin_menu":"hành động cho chủ đề","wizard_required":"Chào mừng bạn đến với Discourse! Hãy bắt đầu với \u003ca href='%{url}' data-auto-route='true'\u003ehướng dẫn cài đặt\u003c/a\u003e ✨","emails_are_disabled":"Ban quản trị đã tắt mọi email gửi đi. Sẽ không có bất kỳ thông báo nào qua email được gửi đi.","bootstrap_mode_enabled":"Để đơn giản hoá quá trình triển khai trang web, bạn đang ở trong chế độ bootstrap. Mọi người dùng mới đều có mức độ tin cậy 1 và sẽ nhận được email cập nhật thông tin mỗi ngày. Chế độ này sẽ tự động tắt khi số người dùng vượt qua %{min_users}","bootstrap_mode_disabled":"Chế độ bootstrap sẽ bị vô hiệu trong 24 giờ tới.","themes":{"default_description":"Mặc định","broken_theme_alert":"Site của bạn có thể không hoạt động vì theme / component %{theme} bị lỗi. Tắt nó ở %{path}"},"s3":{"regions":{"ap_northeast_1":"Châu Á Thái Bình Dương (Tokyo)","ap_northeast_2":"Châu Á Thái Bình Dương (Seoul)","ap_south_1":"Châu Á Thái Bình Dương (Mumbai)","ap_southeast_1":"Châu Á Thái Bình Dương (Singapore)","ap_southeast_2":"Châu Á Thái Bình Dương (Sydney)","ca_central_1":"Canada (Central)","cn_north_1":"Trung Quốc (Bắc Kinh)","cn_northwest_1":"China (Ningxia)","eu_central_1":"Châu Âu (Frankfurt)","eu_north_1":"EU (Stockholm)","eu_west_1":"Châu Âu (Ireland)","eu_west_2":"Châu Âu (London)","eu_west_3":"EU (Paris)","sa_east_1":"South America (São Paulo)","us_east_1":"US East (N. Virginia)","us_east_2":"US East (Ohio)","us_gov_east_1":"AWS GovCloud (US-East)","us_gov_west_1":"AWS GovCloud (Hoa Kỳ-Tây)","us_west_1":"US West (N. California)","us_west_2":"US West (Oregon)"}},"edit":"sửa tiêu đề và chuyên mục của chủ đề","expand":"Mở rộng","not_implemented":"Tính năng này chưa được hoàn thiện, xin lỗi!","no_value":"Không","yes_value":"Có","submit":"Gửi đi","generic_error":"Rất tiếc, đã có lỗi xảy ra.","generic_error_with_reason":"Đã xảy ra lỗi: %{error}","go_ahead":"Lên đầu","sign_up":"Đăng ký","log_in":"Đăng nhập","age":"Tuổi","joined":"Đã tham gia","admin_title":"Quản trị","show_more":"hiện thêm","show_help":"lựa chọn","links":"Liên kết","links_lowercase":{"other":"liên kết"},"faq":"FAQ","guidelines":"Hướng dẫn","privacy_policy":"Chính sách về quyền riêng tư","privacy":"Sự riêng tư","tos":"Điều khoản dịch vụ","rules":"Các quy tắc","conduct":"Quy tắc ứng xử","mobile_view":"Xem ở chế độ di động","desktop_view":"Xem ở chế độ máy tính","you":"Bạn","or":"hoặc","now":"ngay lúc này","read_more":"đọc thêm","more":"Nhiều hơn","less":"Ít hơn","never":"không bao giờ","every_30_minutes":"mỗi 30 phút","every_hour":"mỗi giờ","daily":"hàng ngày","weekly":"hàng tuần","every_month":"hàng tháng","every_six_months":"mỗi sáu tháng","max_of_count":"tối đa trong {{count}}","alternation":"hoặc","character_count":{"other":"{{count}} ký tự"},"related_messages":{"title":"Tin nhắn liên quan","see_all":"Xem \u003ca href=\"%{path}\"\u003e toàn bộ tin nhắn \u003c/a\u003e từ %{username}..."},"suggested_topics":{"title":"Chủ đề tương tự","pm_title":"Tin nhắn gợi ý"},"about":{"simple_title":"Giới thiệu","title":"Giới thiệu về %{title}","stats":"Thống kê trang","our_admins":"Các quản trị viên","our_moderators":"Các điều hành viên","moderators":"Điều hành viên","stat":{"all_time":"Từ trước tới nay","last_7_days":"7 ngày gần nhất","last_30_days":"30 ngày gần nhất"},"like_count":"Lượt thích","topic_count":"Các chủ đề","post_count":"Các bài viết","user_count":"Người dùng","active_user_count":"Thành viên tích cực","contact":"Liên hệ chúng tôi","contact_info":"Trong trường hợp có bất kỳ sự cố nào ảnh hưởng tới trang này, xin vui lòng liên hệ với chúng tôi theo địa chỉ %{contact_info}."},"bookmarked":{"title":"Dấu trang","clear_bookmarks":"Xoá dấu trang","help":{"bookmark":"Chọn bài viết đầu tiên của chủ đề cho vào dấu trang","unbookmark":"Chọn để xoá toàn bộ dấu trang trong chủ đề này"}},"bookmarks":{"created":"bạn đã đánh dấu bài viết này","not_bookmarked":"đánh dấu bài viết này","remove":"Xóa dấu trang","confirm_clear":"Bạn có chắc muốn xóa toàn bộ đánh dấu trong chủ đề này?","save":"Lưu","no_timezone":"Bạn chưa đặt múi giờ. Bạn sẽ không thể đặt lời nhắc. Thiết lập một \u003ca href=\"%{basePath}/my/preferences/profile\"\u003etrong hồ sơ của bạn\u003c/a\u003e .","reminders":{"at_desktop":"Lần sau tôi ở máy tính để bàn của tôi","tomorrow":"Ngày mai","next_week":"Tuần tới","next_month":"Tháng t","custom":"Ngày giờ tùy chỉnh"}},"drafts":{"resume":"Làm lại","remove":"Xoá","new_topic":"Chủ đề nháp mới","new_private_message":"Tin nhắn nháp mới","topic_reply":"Trả lời nháp","abandon":{"confirm":"Bạn đã tạo một bản nháp trong chủ đề này. Bạn có chắc muốn từ bỏ nó?","yes_value":"Đồng ý, bỏ","no_value":"Không, giữ lại"}},"topic_count_latest":{"other":"Xem {{count}} chủ đề mới hoặc được cập nhật"},"topic_count_unread":{"other":"Xem {{count}} chủ đề chưa đọc"},"topic_count_new":{"other":"Xem {{count}} chủ đề mới"},"preview":"xem trước","cancel":"hủy","save":"Lưu thay đổi","saving":"Đang lưu ...","saved":"Đã lưu!","upload":"Tải lên","uploading":"Đang tải lên...","uploading_filename":"Tải lên: {{filename}}...","clipboard":"clipboard","uploaded":"Đã tải lên!","pasting":"Đang gõ","enable":"Kích hoạt","disable":"Vô hiệu hóa","continue":"Tiếp tục","undo":"Hoàn tác","revert":"Phục hồi","failed":"Thất bại","switch_to_anon":"Vào chế độ Ẩn danh","switch_from_anon":"Thoát chế độ Ẩn danh","banner":{"close":"Ẩn banner này.","edit":"Sửa banner này \u003e\u003e"},"pwa":{"install_banner":"Bạn có muốn \u003ca href\u003ecài đặt %{title} trên thiết bị này?\u003c/a\u003e "},"choose_topic":{"none_found":"Không tìm thấy chủ đề nào","title":{"search":"Tìm kiếm một chủ đề","placeholder":"nhập tiêu đề chủ đề, url hoặc id ở đây"}},"choose_message":{"none_found":"Không tìm thấy tin nhắn nào.","title":{"search":"Tìm kiếm một tin nhắn","placeholder":"nhập tiêu đề tin nhắn, url hoặc id ở đây"}},"review":{"order_by":"Lọc bởi","in_reply_to":"trong trả lời tới","explain":{"why":"giải thích lý do tại sao mặt hàng này kết thúc trong hàng đợi","title":"Chấm điểm","formula":"Công thức","subtotal":"Tổng phụ","total":"Tổng số","min_score_visibility":"Điểm tối thiểu cho khả năng hiển thị","score_to_hide":"Điểm để ẩn bài","take_action_bonus":{"name":"hanh động","title":"Khi một nhân viên chọn hành động, cờ sẽ được thưởng."},"user_accuracy_bonus":{"name":"độ chính xác của người dùng","title":"Người dùng có cờ đã được đồng ý trong lịch sử được tặng tiền thưởng."},"trust_level_bonus":{"name":"mức độ tin cậy","title":"Các mục có thể xem lại được tạo bởi người dùng có mức độ tin cậy cao hơn có điểm cao hơn."},"type_bonus":{"name":"loại tiền thưởng","title":"Một số loại có thể xem lại có thể được nhân viên chỉ định một phần thưởng để làm cho chúng có mức độ ưu tiên cao hơn."}},"claim_help":{"optional":"Bạn có thể phàn nàn mục này để tránh những người khác đánh giá nó.","required":"Bạn phải yêu cầu các mục trước khi bạn có thể xem xét chúng.","claimed_by_you":"Bạn đã yêu cầu mặt hàng này và có thể xem xét nó.","claimed_by_other":"Mục này chỉ có thể được xem xét bởi \u003cb\u003e{{username}}\u003c/b\u003e ."},"claim":{"title":"yêu cầu chủ đề này"},"unclaim":{"help":"xóa yêu cầu này"},"awaiting_approval":"Đang đợi Phê duyệt","delete":"Xóa","settings":{"saved":"Lưu trữ","save_changes":"Lưu thay đổi","title":"Xác lập","priorities":{"title":"Ưu tiên xem lại"}},"moderation_history":"Lịch sử kiểm duyệt","view_all":"Xem tất cả","grouped_by_topic":"Được nhóm theo chủ đề","none":"Không có mục nào cần đánh giá.","view_pending":"xem hàng đợi","topic_has_pending":{"other":"Chủ đề này có \u003cb\u003e{{count}}\u003c/b\u003e bài viết đang cần phê duyệt"},"title":"Review","topic":"Chủ đề:","filtered_topic":"Bạn đã lọc đến nội dung có thể xem lại trong một chủ đề.","filtered_user":"Người dùng","show_all_topics":"hiển thị toàn bộ chủ đề","deleted_post":"(bài viết đã bị xóa)","deleted_user":"(người dùng đã bị xóa)","user":{"bio":"Tiểu sử","website":"Trang web","username":"Tên đăng nhập","email":"Email","name":"Tên","fields":"Trường tùy biến"},"user_percentage":{"summary":{"other":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} tổng cộng gắn cờ)"},"agreed":{"other":"{{count}}đồng ý"},"disagreed":{"other":"{{count}} không đồng ý"},"ignored":{"other":"{{count}} bỏ qua"}},"topics":{"topic":"Chủ đề","reviewable_count":"Đếm","reported_by":"Báo cáo bởi","deleted":"[Chủ đề bị xóa]","original":"(chủ đề gốc)","details":"chi tiết","unique_users":{"other":"{{count}} người dùng"}},"replies":{"other":"{{count}} trả lời"},"edit":"Sửa","save":"Lưu","cancel":"Hủy","new_topic":"Phê duyệt mục này sẽ tạo một chủ đề mới","filters":{"all_categories":"(tất cả danh mục)","type":{"title":"Loại","all":"(tất cả các loại)"},"minimum_score":"Điểm tối thiểu:","refresh":"Tải lại","status":"Trạng thái","category":"Danh mục","orders":{"priority":"Mức độ ưu tiên","priority_asc":"Mức độ ưu tiên (đảo ngược)","created_at":"Được tạo tại","created_at_asc":"Tạo tại (đảo ngược)"},"priority":{"title":"Ưu tiên tối thiểu","low":"(bất kỳ)","medium":"Trung bình","high":"Cao"}},"conversation":{"view_full":"xem toàn bộ hội thoại"},"scores":{"about":"Điểm số này được tính toán dựa trên mức độ tin cậy của người báo cáo, độ chính xác của những gắn cờ trước đó, và mức độ ưu tiên của mục được báo cáo.","score":"Điểm số","date":"Ngày","type":"Loại","status":"Trạng thái","submitted_by":"Được gửi bởi","reviewed_by":"Được đánh giá bởi"},"statuses":{"pending":{"title":"Đang treo"},"approved":{"title":"Đã phê duyệt"},"rejected":{"title":"Từ chối"},"ignored":{"title":"Đã bỏ qua"},"deleted":{"title":"Đã xóa"},"reviewed":{"title":"(tất cả đã đánh giá)"},"all":{"title":"(mọi thứ)"}},"types":{"reviewable_flagged_post":{"title":"Bài viết bị gắn cờ","flagged_by":"Gắn cờ bởi"},"reviewable_queued_topic":{"title":"Chủ đề được lên lịch"},"reviewable_queued_post":{"title":"Bài viết được xếp lịch"},"reviewable_user":{"title":"Người dùng"}},"approval":{"title":"Bài viết cần phê duyệt","description":"Chúng tôi đã nhận được bài viết mới của bạn, nhưng nó cần phải được phê duyệt bởi admin trước khi được hiện. Xin hãy kiên nhẫn.","pending_posts":{"other":"Bạn có \u003cstrong\u003e{{count}}\u003c/strong\u003e bài viết đang chờ."},"ok":"OK"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e đã đăng \u003ca href='{{topicUrl}}'\u003echủ đề\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eBạn\u003c/a\u003e đã đăng \u003ca href='{{topicUrl}}'\u003echủ đề\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e đã trả lời tới \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eBạn\u003c/a\u003e đã trả lời \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e đã trả lời \u003ca href='{{topicUrl}}'\u003echủ đề\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eBạn\u003c/a\u003e đã trả lời \u003ca href='{{topicUrl}}'\u003echủ đề\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e đã nhắc đến \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e đã nhắc tới \u003ca href='{{user2Url}}'\u003ebạn\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eBạn\u003c/a\u003e đã nhắc đến \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","posted_by_user":"Được đăng bởi \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"Được đăng bởi \u003ca href='{{userUrl}}'\u003ebạn\u003c/a\u003e","sent_by_user":"Đã gửi bởi \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"Đã gửi bởi \u003ca href='{{userUrl}}'\u003ebạn\u003c/a\u003e"},"directory":{"filter_name":"lọc theo tên đăng nhập","title":"Người dùng","likes_given":"Đưa ra","likes_received":"Đã nhận","topics_entered":"Đã xem","topics_entered_long":"Chủ đề đã xem","time_read":"Thời gian đọc","topic_count":"Chủ đề","topic_count_long":"Chủ đề đã được tạo","post_count":"Trả lời","post_count_long":"Trả lời đã đăng","no_results":"Không tìm thấy kết quả.","days_visited":"Ghé thăm","days_visited_long":"Ngày đã ghé thăm","posts_read":"Đã đọc","posts_read_long":"Bài đăng đã đọc","total_rows":{"other":"%{count} người dùng"}},"group_histories":{"actions":{"change_group_setting":"Đổi cài đặt nhóm","add_user_to_group":"Thêm người dùng","remove_user_from_group":"Xoá người dùng","make_user_group_owner":"Đặt làm người sở hữu","remove_user_as_group_owner":"Huỷ quyền sở hữu"}},"groups":{"member_added":"Đã thêm","member_requested":"Yêu cầu tại","add_members":{"title":"Thêm thành viên","description":"Quản lý hội viên của nhóm","usernames":"Tên người dùng"},"requests":{"title":"Những yêu cầu","reason":"Lý do","accept":"Chấp nhận","accepted":"đã chấp nhận","deny":"Từ chối","denied":"Đã từ chối","undone":"yêu cầu bị hủy"},"manage":{"title":"Quản lý","name":"Tên","full_name":"Tên đầy đủ","add_members":"Thêm thành viên","delete_member_confirm":"Xóa %{username}ra khỏi nhóm %{group}?","profile":{"title":"Hồ sơ"},"interaction":{"title":"Tương tác","posting":"Gửi bài","notification":"Thông báo"},"membership":{"title":"Thành viên","access":"Truy cập"},"logs":{"title":"Log","when":"Khi","action":"Hành động","acting_user":"Người dùng đang hoạt động","target_user":"Người dùng mục tiêu","subject":"Tiêu đề","details":"Chi tiết","from":"Từ","to":"Tới"}},"public_admission":"Cho phép Thành viên tham gia nhóm một cách tự do (nhóm hiển thị công khai)","public_exit":"Cho phép Thành viên thoát khỏi nhóm một cách tự do","empty":{"posts":"Không có bài viết nào của các thành viên trong nhóm này","members":"Không có thành viên nào trong nhóm này","requests":"Không có yêu cầu gia nhập nào cho nhóm này.","mentions":"Group này chưa được nhắc tới lần nào.","messages":"Không có tin nhắn nào của nhóm này","topics":"Không có chủ đề nào được gửi bởi thành viên của nhóm này.","logs":"Không có bản ghi nào dành cho nhóm này"},"add":"Thêm","join":"Tham gia","leave":"Rời nhóm","request":"Yêu cầu","message":"Tin nh","confirm_leave":"Bạn có chắc muốn rời khỏi nhóm này?","membership_request_template":"đã tùy chỉnh để hiển thị cho người dùng khi gửi yêu cầu thành viên","membership_request":{"submit":"Gửi yêu c","title":"Yêu cầu tham gia @%{group_name}","reason":"Cho phép chủ sở hữu nhóm biết lý do bạn thuộc nhóm này"},"membership":"Thành viên","name":"Tên","group_name":"Tên nhóm","user_count":"Người dùng","bio":"Thông tin về nhóm","selector_placeholder":"nhập tên tài khoản","owner":"chủ","index":{"title":"Nhóm","all":"Tất cả các nhóm","empty":"Không có nhóm công khai nào.","filter":"Lọc bởi loại nhóm","owner_groups":"Nhóm của tôi","close_groups":"Nhóm đóng","automatic_groups":"Các nhóm tự động","automatic":"Tự động","closed":"Đã ","public":"Công khai","private":"Riêng tư","public_groups":"Nhóm công khai","automatic_group":"Nhóm tự động","close_group":"Nhóm riêng tư","my_groups":"Nhóm của tôi","group_type":"Loại nhóm","is_group_user":"Thành viên","is_group_owner":"Chủ sở hữu"},"title":{"other":"Nhóm"},"activity":"Hoạt động","members":{"title":"Các thành viên","filter_placeholder_admin":"username hoặc email","filter_placeholder":"tên người dùng","remove_member":"Xóa thành viên","remove_member_description":"Xóa \u003cb\u003e%{username}\u003c/b\u003e khỏi group này","make_owner":"Thêm chủ sở hữu","make_owner_description":"Thêm \u003cb\u003e%{username}\u003c/b\u003e là một chủ sở hữu của nhóm này","remove_owner":"Xóa chủ sở hữu","remove_owner_description":"Xóa quyền sở hữu nhóm này của \u003cb\u003e%{username}\u003c/b\u003e ","owner":"Chủ sở hữu","forbidden":"Bạn không được phép xem thành viên."},"topics":"Chủ đề","posts":"Các bài viết","mentions":"Được nhắc đến","messages":"Tin nhắn","notification_level":"Mức độ thông báo mặc định cho các tin nhắn trong nhóm","alias_levels":{"mentionable":"Ai có thể @mention nhóm này?","messageable":"Ai có thể gửi tin nhắn cho nhóm này?","nobody":"Không ai cả","only_admins":"Chỉ các quản trị viên","mods_and_admins":"Chỉ có người điều hành và ban quản trị","members_mods_and_admins":"Chỉ có thành viên trong nhóm, ban điều hành, và ban quản trị","owners_mods_and_admins":"Chỉ chủ sở hữu, điều hành viên và quản trị viên.","everyone":"Mọi người"},"notifications":{"watching":{"title":"Đang theo dõi","description":"Bạn sẽ được thông báo khi có bài viết mới trong mỗi tin nhắn, và số lượng trả lời mới sẽ được hiển thị"},"watching_first_post":{"title":"Theo dõi chủ đề đầu tiên","description":"Bạn sẽ được thông báo về tin nhắn mới trong nhóm này nhưng không trả lời tin nhắn."},"tracking":{"title":"Đang theo dõi","description":"Bạn sẽ được thông báo nếu ai đó đề cập đến @tên bạn hoặc trả lời bạn, và số lượng trả lời mới sẽ được hiển thị"},"regular":{"title":"Bình thường","description":"Bạn sẽ được thông báo nếu ai đó đề cập đến @tên bạn hoặc trả lời bạn"},"muted":{"title":"Im lặng","description":"Bạn sẽ không được thông báo về bất kì tin nhắn nào trong nhóm này nữa."}},"flair_url":"Ảnh đại diện","flair_url_placeholder":"(Tuỳ chọn) Link đến hình ảnh hoặc lớp Font Awesome","flair_url_description":"Ảnh hình vuông của bạn không được nhỏ hơn 20px x 20px hoặc FontAwesome không hợp lệ (chấp nhận: \"fa-icon\", \"far fa-icon\" hoặc \"fab fa-icon\").","flair_bg_color":"Màu nền ảnh đại diện","flair_bg_color_placeholder":"(Tuỳ chọn) Giá trị mã màu Hexa","flair_color":"Màu ảnh đại diện","flair_color_placeholder":"(Tuỳ chọn) Giá trị mã màu Hexa","flair_preview_icon":"Biểu tượng xem trước","flair_preview_image":"Ảnh xem trước"},"user_action_groups":{"1":"Lượt thích","2":"Lần được thích","3":"Chỉ mục","4":"Các chủ đề","5":"Trả lời","6":"Phản hồi","7":"Được nhắc đến","9":"Lời trích dẫn","11":"Biên tập","12":"Bài đã gửi","13":"Hộp thư","14":"Đang chờ xử lý","15":"Nháp"},"categories":{"all":"tất cả chuyên mục","all_subcategories":"Tất cả","no_subcategory":"không có gì","category":"Chuyên mục","category_list":"Hiễn thị danh sách chuyên mục","reorder":{"title":"Sắp xếp lại danh mục","title_long":"Tổ chức lại danh sách danh mục","save":"Lưu thứ tự","apply_all":"Áp dụng","position":"Vị trí"},"posts":"Bài viết","topics":"Chủ đề","latest":"Mới nhất","latest_by":"mới nhất bởi","toggle_ordering":"chuyển lệnh kiểm soát","subcategories":"Phân loại phụ","topic_sentence":{"other":"%{count} chủ đề"},"topic_stat_sentence_week":{"other":"%{count}chủ đề mới trong tuần qua."},"topic_stat_sentence_month":{"other":"%{count}chủ đề mới trong tháng qua."},"n_more":"Chuyên mục (thêm %{count} ) ..."},"ip_lookup":{"title":"Tìm kiếm địa chỉ IP","hostname":"Hostname","location":"Vị trí","location_not_found":"(không biết)","organisation":"Công ty","phone":"Điện thoại","other_accounts":"Tài khoản khác với địa chỉ IP này","delete_other_accounts":"Xoá %{count}","username":"tên đăng nhập","trust_level":"TL","read_time":"thời gian đọc","topics_entered":"chủ để đã xem","post_count":"# bài viết","confirm_delete_other_accounts":"Bạn có muốn xóa những tài khoản này không?","powered_by":"sử dụng \u003ca href='https://maxmind.com'\u003e MaxMindDB \u003c/a\u003e","copied":"đã sao chép"},"user_fields":{"none":"(chọn một tùy chọn)"},"user":{"said":"{{username}}:","profile":"Tiểu sử","mute":"Im lặng","edit":"Tùy chỉnh","download_archive":{"button_text":"Tải tất c","confirm":"Bạn có chắc chắn muốn download các bài viết của mình?","success":"Quá trình tải về đã bắt đầu, bạn sẽ được thông báo qua tin nhắn khi quá trình hoàn tất.","rate_limit_error":"Bài viết chỉ được tải về một lần mỗi người, hãy thử lại vào ngày mai."},"new_private_message":"Tin nhắn mới","private_message":"Tin nhắn","private_messages":"Tin nhắn","user_notifications":{"ignore_duration_title":"Bỏ qua bộ đếm giờ","ignore_duration_username":"Tên đăng nhập","ignore_duration_when":"Thời lượng:","ignore_duration_save":"Bỏ qua","ignore_no_users":"Bạn không có thành viên bị chặn nào.","ignore_option":"Đã bỏ qua","add_ignored_user":"Thêm...","mute_option":"Im lặng","normal_option":"Bình thường"},"activity_stream":"Hoạt động","preferences":"Tùy chỉnh","feature_topic_on_profile":{"open_search":"Chọn chủ đề mới","title":"Chọn chủ đề","search_label":"Tìm kiếm chủ đề theo tiêu đề","save":"Lưu","clear":{"title":"Xóa"}},"expand_profile":"Mở","collapse_profile":"Thu gọn","bookmarks":"Theo dõi","bio":"Về tôi","timezone":"Múi giờ","invited_by":"Được mời bởi","trust_level":"Độ tin tưởng","notifications":"Thông báo","statistics":"Thống kê","desktop_notifications":{"not_supported":"Xin lỗi. Trình duyệt của bạn không hỗ trợ Notification.","perm_default":"Mở thông báo","perm_denied_btn":"Không có quyền","perm_denied_expl":"Bạn đã từ chối nhận thông báo, để nhận lại bạn cần thiết lập trình duyệt.","disable":"Khóa Notification","enable":"Cho phép Notification","each_browser_note":"Lưu ý: Bạn phải thay đổi trong cấu hình mỗi trình duyệt bạn sử dụng."},"dismiss":"Hủy bỏ","dismiss_notifications":"Bỏ qua tất cả","dismiss_notifications_tooltip":"Đánh dấu đã đọc cho tất cả các thông báo chưa đọc","first_notification":"Thông báo đầu tiên của bạn! Chọn để bắt đầu","dynamic_favicon":"Hiển thị đếm  trên icon trình duyệt","theme_default_on_all_devices":"Đặt giao diện này là mặc định trên tất cả các thiết bị của tôi","external_links_in_new_tab":"Mở tất cả liên kết bên ngoài trong thẻ mới","enable_quoting":"Bật chế độ làm nổi bật chữ trong đoạn trích dẫn trả lời","change":"thay đổi","moderator":"{{user}} trong ban quản trị","admin":"{{user}} là người điều hành","moderator_tooltip":"Thành viên này là MOD","admin_tooltip":"Thành viên này là admin","suspended_notice":"Thành viên này bị đình chỉ cho đến ngày {{date}}. ","suspended_permanently":"Người dùng này đã bị tạm ngưng.","suspended_reason":"Lý do: ","github_profile":"Github","email_activity_summary":"Tóm tắt hoạt động","mailing_list_mode":{"label":"Chế độ mailing list","enabled":"Bật chế độ mailing list","instructions":"\nCài đặt này ghi đè tổng quan về hoạt động\u003cbr /\u003e\n\nTopic bị đánh dấu im lặng và chuyên mục sẽ không bao gồm trong thư\n","individual":"Gửi email cho mỗi bài viết mới.","individual_no_echo":"Gửi email cho mỗi bài viết mới trừ bài viết của tôi","many_per_day":"Gửi email cho tôi về mỗi bài viết mới (khoảng {{dailyEmailEstimate}} thư một ngày)","few_per_day":"Gửi email cho tôi về mỗi bài viết mới (khoảng 2 thư một ngày)"},"tag_settings":"Thẻ","watched_tags":"Theo dõi","watched_tags_instructions":"Chế độ theo dõi sẽ tự động bật với những chủ đề được gắn thẻ này. Bạn sẽ được thông báo về tất cả các bài viết, chủ đề mới và số lượng bài viết mới sẽ hiển thị bên cạnh chủ đề kế tiếp.","tracked_tags":"Theo dõi","tracked_tags_instructions":"Chế độ theo dõi sẽ tự động bật với những chủ đề được gắn thẻ này. Số lượng bài viết mới sẽ xuất hiện bên cạnh chủ đề.","muted_tags":"Im lặng","muted_tags_instructions":"Bạn sẽ không được thông báo về bất kì hoạt động nào ở những chủ đề có thẻ này, chúng cũng sẽ không xuất hiện như là những chủ đề mới nhất.","watched_categories":"Đã theo dõi","watched_categories_instructions":"Bạn sẽ tự động theo dõi tất cả các chủ đề trong những chuyên mục này. Bạn sẽ nhận được tin báo về những bài viết và chủ đề mới, cùng với số lượng bài viết mới cũng sẽ xuất hiện kế bên chủ đề đó.","tracked_categories":"Theo dõi","watched_first_post_categories":"Xem bài viết đầu tiên","watched_first_post_categories_instructions":"Bạn sẽ nhận được thông báo khi có ai đó đăng chủ đề mới trong thư mục này.","watched_first_post_tags":"Xem bài viết đầu tiên","watched_first_post_tags_instructions":"Bạn sẽ nhận được thông báo khi có ai đó đăng chủ đề mới có chứa thẻ này.","muted_categories":"Im lặng","delete_account":"Xoá Tài khoản của tôi","delete_account_confirm":"Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản của bạn? Hành động này không thể được hoàn tác!","deleted_yourself":"Tài khoản của bạn đã được xóa thành công.","unread_message_count":"Tin nhắn","admin_delete":"Xoá","users":"Thành viên","muted_users":"Im lặng","muted_users_instructions":"Ngăn chặn tất cả các thông báo từ những thành viên.","ignored_users":"Đã bỏ qua","tracked_topics_link":"Hiển thị","automatically_unpin_topics":"Tự động bỏ ghim chủ đề khi tôi xuống cuối trang.","apps":"Ứng dụng","revoke_access":"Lấy lại quyền","undo_revoke_access":"Cấp lại quyền","api_approved":"Chấp thuận:","api_last_used_at":"Sử dụng lần cuối lúc:","theme":"Giao diện","home":"Trang chủ mặc định","staff_counters":{"flags_given":"cờ hữu ích","flagged_posts":"bài viết gắn cờ","deleted_posts":"bài viết bị xoá","suspensions":"đình chỉ","warnings_received":"cảnh báo"},"messages":{"all":"Tất cả","inbox":"Hộp thư","sent":"Đã gửi","archive":"Lưu Trữ","groups":"Nhóm của tôi","bulk_select":"Chọn tin nhắn","move_to_inbox":"Chuyển sang hộp thư","move_to_archive":"Lưu trữ","failed_to_move":"Lỗi khi chuyển các tin nhắn đã chọn (có thể do lỗi mạng)","select_all":"Chọn tất cả","tags":"Thẻ"},"preferences_nav":{"account":"Tài khoản","profile":"Hồ sơ","emails":"Email","notifications":"Thông báo","categories":"Chuyên mục","users":"Người dùng","tags":"Thẻ","interface":"Giao diện","apps":"Ứng dụng"},"change_password":{"success":"(email đã gửi)","in_progress":"(đang gửi email)","error":"(lỗi)","action":"Gửi lại mật khẩu tới email","set_password":"Nhập Mật khẩu","choose_new":"Chọn một mật khẩu mới","choose":"Chọn một mật khẩu"},"second_factor_backup":{"regenerate":"Khởi tạo lại","disable":"Vô hiệu hóa","enable":"Kích hoạt","enable_long":"Bật backup codes","copied_to_clipboard":"Sao chép vào Clipboard","copy_to_clipboard_error":"Lỗi sao chép dữ liệu vào Clipboard","remaining_codes":"Bạn có \u003cstrong\u003e{{count}}\u003c/strong\u003e mã sao lưu còn lại.","use":"Sử dụng mã dự phòng"},"second_factor":{"title":"Xác minh hai bước","name":"Tên","show_key_description":"Nhập thủ công","oauth_enabled_warning":"Xin lưu ý rằng thông tin đăng nhập xã hội sẽ bị vô hiệu hóa khi xác thực hai yếu tố đã được bật trên tài khoản của bạn.","edit":"Sửa","totp":{"default_name":"Authenticator của bạn"},"security_key":{"delete":"Xóa"}},"change_about":{"title":"Thay đổi thông tin về tôi","error":"Có lỗi xảy ra khi thay đổi giá trị này."},"change_username":{"title":"Thay Username","taken":"Xin lỗi, đã có username này.","invalid":"Username này không thích hợp. Nó chỉ chứa các ký tự là chữ cái và chữ số. "},"change_email":{"title":"Thay đổi Email","taken":"Xin lỗi, email này không dùng được. ","error":"Có lỗi xảy ra khi thay đổi email của bạn. Có thể địa chỉ email đã được sử dụng ?","success":"Chúng tôi đã gửi email tới địa chỉ đó. Vui lòng làm theo chỉ dẫn để xác nhận lại."},"change_avatar":{"title":"Đổi ảnh đại diện","letter_based":"Hệ thống xác định ảnh đại diện","uploaded_avatar":"Chính sửa hình ảnh","uploaded_avatar_empty":"Thêm một ảnh chỉnh sửa","upload_title":"Upload hình ảnh của bạn","image_is_not_a_square":"Cảnh báo: chúng tôi đã cắt hình ảnh của bạn; chiều rộng và chiều cao không bằng nhau."},"change_card_background":{"title":"Hình nền Card","instructions":"Hình nền sẽ ở giữa và có chiều rộng mặc định là 590px."},"email":{"title":"Email","primary":"Email chính","secondary":"Email thứ hai","no_secondary":"Không có email thứ hai","instructions":"Không hiển thị công cộng","ok":"Chúng tôi sẽ gửi thư điện tử xác nhận đến cho bạn","invalid":"Vùi lòng nhập một thư điện tử hợp lệ","authenticated":"Thư điện tử của bạn đã được xác nhận bởi {{provider}}","frequency_immediately":"Chúng tôi sẽ gửi email cho bạn ngay lập tức nếu bạn đã chưa đọc những điều chúng tôi đã gửi cho bạn qua email.","frequency":{"other":"Chúng tôi sẽ chỉ gửi email cho bạn nếu chúng tôi đã không nhìn thấy bạn trong {{count}} phút cuối."}},"associated_accounts":{"connect":"Kết nối","revoke":"Thu hồi","cancel":"Hủy","not_connected":"(không được kết nối)","confirm_modal_title":"Kết nối tài khoản %{provider}"},"name":{"title":"Tên","instructions":"Tên đầy đủ của bạn (tuỳ chọn)","instructions_required":"Tên đầy đủ của bạn","too_short":"Tên của bạn quá ngắn","ok":"Tên của bạn có vẻ ổn"},"username":{"title":"Username","instructions":"Duy nhất, không có khoảng trống, ngắn","short_instructions":"Mọi người có thể nhắc tới bạn bằng @{{username}}","available":"Tên đăng nhập của bạn có sẵn","not_available":"Chưa có sẵn. Thử {{suggestion}}?","not_available_no_suggestion":"Không sẵn có","too_short":"Tên đăng nhập của bạn quá ngắn","too_long":"Tên đăng nhập của bạn quá dài","checking":"Đang kiểm tra username sẵn sàng để sử dụng....","prefilled":"Thư điện tử trủng với tên đăng nhập này."},"locale":{"title":"Ngôn ngữ hiển thị","instructions":"Ngôn ngữ hiển thị sẽ thay đổi khi bạn tải lại trang","default":"(mặc định)","any":"bất kì"},"password_confirmation":{"title":"Nhập lại Password"},"auth_tokens":{"title":"Thiết bị được sử dụng gần đây","ip":"IP","details":"Chi tiết","log_out_all":"Đăng xuất khỏi tất cả","active":"hoạt động bây giờ","not_you":"Không phải bạn?","show_all":"Hiển thị tất cả {{count}}","show_few":"Hiển thị ít hơn","was_this_you":"Đây có phải là bạn không?","secure_account":"Bảo mật Tài khoản của tôi","latest_post":"Bài đăng cuối cùng của bạn..."},"last_posted":"Bài viết cuối cùng","last_emailed":"Đã email lần cuối","last_seen":"được thấy","created":"Đã tham gia","log_out":"Log Out","location":"Vị trí","website":"Web Site","email_settings":"Email","text_size":{"title":"Cở chữ","smaller":"Nhỏ","normal":"Bình thường","larger":"Lớn","largest":"Lớn nhất"},"title_count_mode":{"notifications":"Thông báo mới","contextual":"Trang nội dung mới"},"like_notification_frequency":{"title":"Thông báo khi tôi like","always":"Luôn luôn","first_time_and_daily":"Lần đầu tiên bài viết được like và hàng ngày","first_time":"Lần đầu tiên bài viết được like","never":"Không"},"email_previous_replies":{"title":"Kèm theo các trả lời trước ở dưới cùng email","unless_emailed":"trừ khi đã gửi trước đó","always":"luôn luôn","never":"không"},"email_digests":{"every_30_minutes":"mỗi 30 phút","every_hour":"hàng giờ","daily":"hàng ngày","weekly":"hàng tuần","every_month":"mỗi tháng","every_six_months":"mỗi sáu tháng"},"email_level":{"title":"Gửi cho tôi một email khi có người trích dẫn, trả lời cho bài viết của tôi, đề cập đến @username của tôi, hoặc mời tôi đến một chủ đề","always":"luôn luôn","never":"không bao giờ"},"email_messages_level":"Gửi cho tôi email khi có ai đó nhắn tin cho tôi","include_tl0_in_digests":"Bao gồm nội dung của những thành viên mới trong email tóm tắt.","email_in_reply_to":"Kèm theo đoạn dẫn trích trả lời bài viết trong email","other_settings":"Khác","categories_settings":"Chuyên mục","new_topic_duration":{"label":"Để ý tới chủ đề mới khi","not_viewed":"Tôi chưa từng xem họ","last_here":"tạo ra kể từ lần cuối tôi ở đây","after_1_day":"được tạo ngày hôm qua","after_2_days":"được tạo 2 ngày trước","after_1_week":"được tạo tuần trước","after_2_weeks":"được tạo 2 tuần trước"},"auto_track_topics":"Tự động theo dõi các chủ đề tôi tạo","auto_track_options":{"never":"không bao giờ","immediately":"ngay lập tức","after_30_seconds":"sau 30 giây","after_1_minute":"sau 1 phút","after_2_minutes":"sau 2 phút","after_3_minutes":"sau 3 phút","after_4_minutes":"sau 4 phút","after_5_minutes":"sau 5 phút","after_10_minutes":"sau 10 phút"},"invited":{"search":"gõ để tìm kiếm thư mời ","title":"Lời mời","user":"User được mời","sent":"Gửi lần cuối","none":"Không tìm thấy lời mời nào.","truncated":{"other":"Hiện {{count}} thư mời đầu tiên"},"redeemed":"Lời mời bù lại","redeemed_tab":"Làm lại","redeemed_tab_with_count":"Làm lại ({{count}})","redeemed_at":"Nhận giải","pending":"Lời mời tạm hoãn","pending_tab":"Đang treo","pending_tab_with_count":"Đang xử lý ({{count}})","topics_entered":"Bài viết được xem ","posts_read_count":"Đọc bài viết","expired":"Thư mời này đã hết hạn.","rescind":"Xoá","rescinded":"Lời mời bị xóa","reinvite":"Mời lại","reinvite_all":"Gửi lại tất cả lời mời","reinvite_all_confirm":"Bạn có chắc chắn gửi lại tất cả các lời mời?","reinvited":"Gửi lại lời mời","reinvited_all":"Tất cả lời mời đã được gửi lại","time_read":"Đọc thời gian","days_visited":"Số ngày đã thăm","account_age_days":"Thời gian của tài khoản theo ngày","create":"Gửi một lời mời","generate_link":"Chép liên kết Mời","link_generated":"Link mời đã được tạo thành công !","valid_for":"Link mời chỉ có hiệu lực với địa chỉ email: %{email}","bulk_invite":{"text":"Mời hàng loạt bằng file","success":"Tải lên thành công, bạn sẽ được thông báo qua tin nhắn khi quá trình hoàn tất.","error":"Xin lỗi, file phải ở định dạng CSV."}},"password":{"title":"Mật khẩu","too_short":"Mật khẩu của bạn quá ngắn.","common":"Mật khẩu quá đơn giản, rất dễ bị đoán ra","same_as_username":"Mật khẩu của bạn trùng với tên đăng nhập.","same_as_email":"Mật khẩu của bạn trùng với email của bạn.","ok":"Mật khẩu của bạn có vẻ ổn.","instructions":"ít nhất %{count} kí tự"},"summary":{"title":"Tóm tắt","stats":"Thống kê","time_read":"thời gian đọc","recent_time_read":"đã đọc gần đây","topic_count":{"other":"Chủ đề đã được tạo"},"post_count":{"other":"Bài viết đã được tạo"},"likes_given":{"other":"nhận"},"likes_received":{"other":"Đã nhận"},"days_visited":{"other":"Ngày đã ghé thăm"},"topics_entered":{"other":"chủ đề đã xem"},"posts_read":{"other":"Bài viết đã đọc"},"bookmark_count":{"other":"Dấu trang"},"top_replies":"Top trả lời","no_replies":"Chưa có trả lời.","more_replies":"Thêm trả lời","top_topics":"Top chủ đề","no_topics":"Chưa có chủ đề nào.","more_topics":"Thêm chủ đề","top_badges":"Top huy hiệu","no_badges":"Chưa có huy hiệu nào.","more_badges":"Thêm huy hiệu","top_links":"Liên kết đầu","no_links":"Không có liên kết","most_liked_by":"Được thích nhiều nhất bởi","most_liked_users":"Like nhiều nhất","no_likes":"Chưa có lượt thích.","topics":"Chủ đề","replies":"Trả lời"},"ip_address":{"title":"Địa chỉ IP cuối cùng"},"registration_ip_address":{"title":"Địa chỉ IP đăng ký"},"avatar":{"title":"Ảnh đại diện","header_title":"hồ sơ cá nhân, tin nhắn, đánh dấu và sở thích"},"title":{"title":"Tiêu đề","none":"(không có gì)"},"primary_group":{"title":"Nhóm Chính","none":"(không có gì)"},"filters":{"all":"All"},"stream":{"posted_by":"Đăng bởi","sent_by":"Gửi bởi","private_message":"tin nhắn","the_topic":"chủ đề"}},"loading":"Đang tải...","errors":{"prev_page":"trong khi cố gắng để tải","reasons":{"network":"Mạng Internet bị lỗi","server":"Máy chủ đang có vấn đề","forbidden":"Bạn không thể xem được","unknown":"Lỗi","not_found":"Không Tìm Thấy Trang"},"desc":{"network":"Hãy kiểm tra kết nối của bạn","network_fixed":"Hình như nó trở lại.","server":"Mã lỗi : {{status}}","forbidden":"Bạn không được cho phép để xem mục này","not_found":"Oops, ứng dụng đang tải đường dẫn không tồn tại","unknown":"Có một lỗi gì đó đang xảy ra"},"buttons":{"back":"Quay trở lại","again":"Thử lại","fixed":"Load lại trang"}},"modal":{"close":"đóng"},"close":"Đóng lại","assets_changed_confirm":"Website đã được cập nhật bản mới. Bạn có thể làm mới lại trang để có thể sử dụng bản mới được cập nhật","logout":"Bạn đã đăng xuất","refresh":"Tải lại","read_only_mode":{"enabled":"Website đang ở chế độ chỉ đọc, bạn có thể duyệt xem nhưng không thể trả lời, likes, hay thực hiện các hành động khác.","login_disabled":"Chức năng Đăng nhập đã bị tắt khi website trong trạng thái chỉ đọc","logout_disabled":"Chức năng đăng xuất đã bị tắt khi website đang trong trạng thái chỉ đọc."},"learn_more":"tìm hiểu thêm...","all_time":"tổng cộng","all_time_desc":"tổng số chủ đề đã tạo","year":"năm","year_desc":"chủ đề được tạo ra trong 365 ngày qua","month":"tháng","month_desc":"chủ đề được tạo ra trong 30 ngày qua","week":"tuần","week_desc":"chủ đề được tạo ra trong 7 ngày qua","day":"ngày","first_post":"Bài viết đầu tiên","mute":"Im lặng","unmute":"Bỏ im lặng","last_post":"Được gửi","time_read":"Đã đọc","last_reply_lowercase":"trả lời cuối cùng","replies_lowercase":{"other":"trả lời"},"signup_cta":{"sign_up":"Đăng ký","hide_session":"Nhắc vào ngày mai","hide_forever":"không, cảm ơn","hidden_for_session":"OK, Tôi sẽ hỏi bạn vào ngày mai. Bạn có thể luôn luôn sử dụng chức năng đăng nhập để tạo tài khoản."},"summary":{"enabled_description":"Bạn đang xem một bản tóm tắt của chủ đề này: các bài viết thú vị nhất được xác định bởi cộng đồng.","description":"Có \u003cb\u003e{{replyCount}}\u003c/b\u003e trả lời.","description_time":"Có \u003cb\u003e{{replyCount}}\u003c/b\u003e trả lời với thời gian đọc ước tính khoảng \u003cb\u003e{{readingTime}} phút\u003c/b\u003e.","enable":"Tóm tắt lại chủ đề","disable":"HIển thị tất cả các bài viết"},"deleted_filter":{"enabled_description":"Chủ để này có chứa các bài viết bị xoá, chúng đã bị ẩn đi","disabled_description":"Xoá các bài viết trong các chủ để được hiển thị","enable":"Ẩn các bài viết bị xoá","disable":"Xem các bài viết bị xoá"},"private_message_info":{"title":"Tin nhắn","edit":"Thêm hoặc xóa...","remove_allowed_user":"Bạn thực sự muốn xóa {{name}} từ tin nhắn này?","remove_allowed_group":"Bạn thực sự muốn xóa {{name}} từ tin nhắn này?"},"email":"Email","username":"Username","last_seen":"Đã xem","created":"Tạo bởi","created_lowercase":"ngày tạo","trust_level":"Độ tin tưởng","search_hint":"username, email or IP address","create_account":{"disclaimer":"Bằng cách đăng ký, bạn đồng ý với \u003ca href='{{privacy_link}}' target='blank'\u003echính sách bảo mật\u003c/a\u003e và \u003ca href='{{tos_link}}' target='blank'\u003eđiều khoản dịch vụ\u003c/a\u003e.","title":"Tạo tài khoản mới","failed":"Có gì đó không đúng, có thể email này đã được đăng ký, thử liên kết quên mật khẩu"},"forgot_password":{"title":"Đặt lại mật khẩu","action":"Tôi đã quên mật khẩu của tôi","invite":"Điền vào username của bạn hoặc địa chỉ email và chúng tôi sẽ gửi bạn email để khởi tạo lại mật khẩu","reset":"Tạo lại mật khẩu","complete_username":"Nếu một tài khoản phù hợp với tên thành viên \u003cb\u003e%{username} \u003c/b\u003e, bạn sẽ nhận được một email với hướng dẫn về cách đặt lại mật khẩu của bạn trong thời gian ngắn.","complete_email":"Nếu một trận đấu tài khoản \u003cb\u003e%{email} \u003c/b\u003e, bạn sẽ nhận được một email với hướng dẫn về cách đặt lại mật khẩu của bạn trong thời gian ngắn.","complete_username_not_found":"Không có tài khoản phù hợp với tên thành viên \u003cb\u003e%{username} \u003c/b\u003e","complete_email_not_found":"Không tìm thấy tài khoản nào tương ứng với \u003cb\u003e%{email}\u003c/b\u003e","button_ok":"OK","button_help":"Giúp "},"email_login":{"link_label":"Gửi liên kết đăng nhập qua email","button_label":"với email","complete_username":"Nếu một tài khoản khớp với tên người dùng \u003cb\u003e%{username}\u003c/b\u003e, bạn sẽ sớm nhận được email có liên kết đăng nhập.","complete_email":"Nếu một tài khoản phù hợp với \u003cb\u003e%{email}\u003c/b\u003e, bạn sẽ sớm nhận được email có liên kết đăng nhập.","complete_username_found":"Chúng tôi đã tìm thấy một tài khoản phù hợp với tên người dùng \u003cb\u003e%{username}\u003c/b\u003e, bạn sẽ sớm nhận được email có liên kết đăng nhập.","complete_email_found":"Chúng tôi đã tìm thấy một tài khoản phù hợp với \u003cb\u003e%{email}\u003c/b\u003e, bạn sẽ sớm nhận được email có liên kết đăng nhập.","complete_username_not_found":"Không có tài khoản phù hợp với tên thành viên \u003cb\u003e%{username} \u003c/b\u003e","complete_email_not_found":"Không tìm thấy tài khoản nào tương ứng với \u003cb\u003e%{email}\u003c/b\u003e","confirm_title":"Tiếp tục tới %{site_name}","confirm_button":"Kết thúc đăng nhập"},"login":{"title":"Đăng nhập","username":"Thành viên","password":"Mật khẩu","second_factor_title":"Xác minh hai bước","second_factor_description":"Vui lòng nhập mã xác minh từ ứng dụng của bạn:","email_placeholder":"Email hoặc tên đăng nhập ","caps_lock_warning":"Phím Caps Lock đang được bật","error":"Không xác định được lỗi","rate_limit":"Xin đợi trước khi đăng nhập lại lần nữa.","blank_username":"Nhập địa chỉ email và tên người dùng của bạn.","blank_username_or_password":"Bạn phải nhập email hoặc username, và mật khẩu","reset_password":"Khởi tạo mật khẩu","logging_in":"Đăng nhập...","or":"Hoặc","authenticating":"Đang xác thực...","awaiting_activation":"Tài khoản của bạn đang đợi kích hoạt, sử dụng liên kết quên mật khẩu trong trường hợp kích hoạt ở 1 email khác.","awaiting_approval":"Tài khoản của bạn chưa được chấp nhận bới thành viên. Bạn sẽ được gửi một email khi được chấp thuận ","requires_invite":"Xin lỗi, bạn phải được mời để tham gia diễn đàn","not_activated":"Bạn không thể đăng nhập. Chúng tôi đã gửi trước email kích hoạt cho bạn tại \u003cb\u003e{{sentTo}}\u003c/b\u003e. Vui lòng làm theo hướng dẫn trong email để kích hoạt tài khoản của bạn.","not_allowed_from_ip_address":"Bạn không thể đăng nhập từ địa chỉ IP này","admin_not_allowed_from_ip_address":"Bạn không thể đăng nhập với quyền quản trị từ địa chỉ IP đó.","resend_activation_email":"Bấm đây để gửi lại email kích hoạt","resend_title":"Gửi lại email kích hoạt","change_email":"Đổi địa chỉ email","provide_new_email":"Cung cấp địa chỉ mới của bạn và chúng tôi sẽ gửi lại email xác nhận.","submit_new_email":"Cập nhật địa chỉ email","sent_activation_email_again":"Chúng tôi gửi email kích hoạt tới cho bạn ở \u003cb\u003e{{currentEmail}}\u003c/b\u003e. Nó sẽ mất vài phút để đến; bạn nhớ check cả hồm thư spam nhe. ","to_continue":"Vui lòng đăng nhập","preferences":"Bạn cần phải đăng nhập để thay đổi cài đặt tài khoản.","forgot":"Tôi không thể nhớ lại chi tiết tài khoản của tôi.","not_approved":"Tài khoản của bạn chưa được kiểm duyệt. Bạn sẽ nhận được email thông báo khi bạn được phép đăng nhập.","google_oauth2":{"name":"Goole","title":"với Google"},"twitter":{"name":"Twitter","title":"với Twitter"},"instagram":{"name":"Instagram","title":"với Instagram"},"facebook":{"name":"Facebook","title":"với Facebook"},"github":{"name":"GitHub","title":"với GitHub"},"discord":{"name":"Discord"}},"invites":{"accept_title":"Lời mời","welcome_to":"Chào mừng bạn đến với %{site_name}!","invited_by":"Bạn đã được mời bởi:","social_login_available":"Bạn cũng có thể đăng nhập bằng bất kỳ thông tin đăng nhập xã hội nào bằng email đó.","your_email":"Địa chỉ email của bạn là \u003cb\u003e%{email}\u003c/b\u003e.","accept_invite":"Chấp nhận lời mời","name_label":"T","password_label":"Đặt mật kh","optional_description":"(tùy chọn)"},"password_reset":{"continue":"Tiếp tục truy cập %{site_name}"},"emoji_set":{"apple_international":"Apple/International","google":"Google","twitter":"Twitter","win10":"Win10","google_classic":"Google Classic","facebook_messenger":"Facebook Messenger"},"category_page_style":{"categories_only":"Chỉ chuyên mục","categories_with_featured_topics":"Các chuyên mục và chủ đề nổi bật","categories_and_latest_topics":"Các chuyên mục và chủ đề mới","categories_and_top_topics":"Chuyên mục và Chủ đề nổi bật"},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt","enter":"Nhập"},"conditional_loading_section":{"loading":"Đang tải..."},"select_kit":{"default_header_text":"Chọn...","no_content":"Không tìm thấy","filter_placeholder":"Tìm kiến...","filter_placeholder_with_any":"Tìm kiếm hoặc tạo mới...","create":"Tạo mới: '{{content}}'"},"date_time_picker":{"from":"Từ","to":"Tới"},"emoji_picker":{"filter_placeholder":"Tìm kiếm emoji","activities":"Hoạt động","objects":"Vật th","flags":"Dấu cờ - Flags"},"shared_drafts":{"publishing":"Đang xuất bản Chủ đề..."},"composer":{"emoji":"Emoji :)","more_emoji":"thêm...","options":"Lựa chọn","whisper":"nói chuyện","unlist":"chưa được liệt kê","blockquote_text":"Trích dẫn","add_warning":"Đây là một cảnh báo chính thức","toggle_whisper":"Chuyển chế độ Nói chuyện","posting_not_on_topic":"Bài viết nào bạn muốn trả lời ","saved_local_draft_tip":"Đã lưu locally","similar_topics":"Bài viết của bạn tương tự với ","drafts_offline":"Nháp offline","edit_conflict":"chỉnh sửa xung đột","error":{"title_missing":"Tiêu đề là bắt buộc","title_too_short":"Tiêu để phải có ít nhất {{min}} ký tự","title_too_long":"Tiêu đề có tối đa {{max}} ký tự","post_length":"Bài viết phải có ít nhất {{min}} ký tự","category_missing":"Bạn phải chọn một phân loại"},"save_edit":"Lưu chỉnh sửa","reply_original":"Trả lời cho bài viết gốc","reply_here":"Trả lời đây ","reply":"Trả lời ","cancel":"Huỷ","create_topic":"Tạo chủ đề","create_pm":"Tin nhắn","title":"Hoặc nhất Ctrl+Enter","users_placeholder":"Thêm thành viên ","title_placeholder":"Tóm tắt lại thảo luận này trong một câu ngắn gọn","title_or_link_placeholder":"Nhập tiêu đề, hoặc dán đường dẫn vào đây","edit_reason_placeholder":"Tại sao bạn sửa","reply_placeholder":"Gõ ở đây. Sử dụng Markdown, BBCode, hoặc HTML để định dạng. Kéo hoặc dán ảnh.","view_new_post":"Xem bài đăng mới của bạn. ","saving":"Đang lưu","saved":"Đã lưu","uploading":"Đang đăng ","show_preview":"Xem trước \u0026raquo;","hide_preview":"\u0026laquo;ẩn xem trước","quote_post_title":"Trích dẫn cả bài viết","bold_label":"B","bold_title":"In đậm","bold_text":"chữ in đậm","italic_label":"I","italic_title":"Nhấn mạnh","italic_text":"văn bản nhấn mạnh","link_title":"Liên kết","link_description":"Nhập mô tả liên kết ở đây","link_dialog_title":"Chèn liên kết","link_optional_text":"tiêu đề tùy chọn","quote_title":"Trích dẫn","quote_text":"Trích dẫn","code_title":"Văn bản định dạng trước","code_text":"lùi đầu dòng bằng 4 dấu cách","paste_code_text":"gõ hoặc dẫn code vào đây","upload_title":"Tải lên","upload_description":"Nhập mô tả tải lên ở đây","olist_title":"Danh sách kiểu số","ulist_title":"Danh sách kiểu ký hiệu","list_item":"Danh sách các mục","help":"Trợ giúp soạn thảo bằng Markdown","modal_ok":"OK","modal_cancel":"Hủy","cant_send_pm":"Xin lỗi, bạn không thể gởi tin nhắn đến %{username}.","yourself_confirm":{"title":"Bạn có quên chưa thêm người nhận?"},"admin_options_title":"Tùy chọn quản trị viên cho chủ đề này","composer_actions":{"reply":"Trả lời ","edit":"Sửa","create_topic":{"label":"Chủ đề Mới"}},"details_title":"Tóm tắt"},"notifications":{"title":"thông báo của @name nhắc đến, trả lời bài của bạn và chủ đề, tin nhắn, vv","none":"Không thể tải các thông báo tại thời điểm này.","empty":"Không có thông báo","post_approved":"Bài đăng của bạn đã được phê duyệt","liked_consolidated_description":{"other":"đã thích {{count}} bài viết của bạn"},"invited_to_private_message":"\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e{{description}}","invitee_accepted":"\u003cspan\u003e{{username}}\u003c/span\u003e đã chấp nhận lời mời của bạn","moved_post":"\u003cspan\u003e{{username}}\u003c/span\u003e đã chuyển {{description}}","popup":{"mentioned":"{{username}} nhắc đến bạn trong \"{{topic}}\" - {{site_title}}","group_mentioned":"{{username}} nhắc đến bạn trong \"{{topic}}\" - {{site_title}}","quoted":"{{username}} trích lời bạn trong \"{{topic}}\" - {{site_title}}","replied":"{{username}} trả lời cho bạn trong \"{{topic}}\" - {{site_title}}","posted":"{{username}} gửi bài trong \"{{topic}}\" - {{site_title}}","linked":"{{username}} liên quan đến bài viết của bạn từ \"{{topic}}\" - {{site_title}}"},"titles":{"liked":"lượt thích mới","watching_first_post":"chủ đề mới"}},"upload_selector":{"title":"Thêm một ảnh","title_with_attachments":"Thêm một ảnh hoặc tệp tin","from_my_computer":"Từ thiết bị của tôi","from_the_web":"Từ Web","remote_tip":"đường dẫn tới hình ảnh","remote_tip_with_attachments":"chọn ảnh hoặc file {{authorized_extensions}}","local_tip":"chọn hình từ thiết bị của bạn","local_tip_with_attachments":"chọn ảnh hoặc file {{authorized_extensions}} từ thiết bị của bạn","hint":"(Bạn cũng có thể kéo \u0026 thả vào trình soạn thảo để tải chúng lên)","hint_for_supported_browsers":"bạn có thể kéo và thả ảnh vào trình soan thảo này","uploading":"Đang tải lên","select_file":"Chọn Tài liệu","default_image_alt_text":"hình ảnh"},"search":{"sort_by":"Sắp xếp theo","relevance":"Độ phù hợp","latest_post":"Bài viết mới nhất","latest_topic":"Chủ đề mới","most_viewed":"Xem nhiều nhất","most_liked":"Thích nhiều nhất","select_all":"Chọn tất cả","clear_all":"Xóa tất cả","too_short":"Từ khoá tìm kiếm của bạn quá ngắn.","result_count":{"other":"Hơn \u003cspan\u003e{{count}}{{plus}} kết quả cho\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e"},"title":"tìm kiếm chủ đề, bài viết, tài khoản hoặc các danh mục","no_results":"Không tìm thấy kết quả.","no_more_results":"Không tìm thấy kết quả","searching":"Đang tìm ...","post_format":"#{{post_number}} bởi {{username}}","results_page":"Kết quả tìm kiếm cho '{{term}}'","search_google_button":"G","search_google_title":"Tìm trong trang n","context":{"user":"Tìm bài viết của @{{username}}","topic":"Tìm trong chủ đề này","private_messages":"Tìm tin nhắn"},"advanced":{"title":"Tìm kiếm nâng cao","posted_by":{"label":"Gửi bởi"},"in_group":{"label":"Trong nhóm"},"with_badge":{"label":"Với huy hiệu"},"filters":{"title":"Chỉ khớp với tiêu đề","likes":"Tôi đã thích","posted":"Tôi đã gửi trong","pinned":"được gim","unpinned":"không được gim","unseen":"Tôi chưa đọc","wiki":"là wiki"},"statuses":{"open":"mở","closed":"bị đóng","archived":"được lưu trữ","noreplies":"không có phản hồi","single_user":"chứa một người dùng"},"post":{"count":{"label":"Số bài viết tối thiểu"},"time":{"label":"Được gửi","before":"trước","after":"sau"}}}},"hamburger_menu":"đi đến danh sách chủ đề hoặc danh mục khác","new_item":"mới","go_back":"quay trở lại","not_logged_in_user":"Trang cá nhân với tóm tắt các hoạt động và cấu hình","current_user":"đi đến trang cá nhân của bạn","topics":{"new_messages_marker":"lần thăm cuối","bulk":{"select_all":"Chọn hết","clear_all":"Xoá hết","unlist_topics":"Chủ đề không công khai","reset_read":"Đặt lại lượt đọc","delete":"Xóa chủ đề","dismiss":"Bỏ qua","dismiss_read":"Bỏ qua tất cả thư chưa đọc","dismiss_button":"Bỏ qua...","dismiss_tooltip":"Bỏ qua chỉ bài viết mới hoặc ngừng theo dõi chủ đề","also_dismiss_topics":"Ngừng theo dõi các chủ đề này để không hiển thị lại là chủ đề chưa đọc","dismiss_new":"Bỏ ","toggle":"chuyển sang chọn chủ đề theo lô","actions":"Hành động theo lô","close_topics":"Đóng các chủ đề","archive_topics":"Chủ đề Lưu trữ","notification_level":"Thông báo","choose_new_category":"Chọn chuyên mục mới cho chủ đề này:","selected":{"other":"Bạn đã chọn \u003cb\u003e{{count}}\u003c/b\u003e chủ đề"},"choose_new_tags":"Chọn thẻ mới cho các chuyên mục sau:"},"none":{"unread":"Bạn không có chủ đề nào chưa đọc.","new":"Bạn không có chủ đề mới nào.","read":"Bạn vẫn chưa đọc bất kì chủ đề nào.","posted":"Bạn vẫn chưa đăng bài trong bất kì một chủ đề nào","latest":"Chán quá. Chẳng có chủ đề mới nào hết trơn.","bookmarks":"Bạn chưa chủ đề nào được đánh dấu.","category":"Không có chủ đề nào trong {{category}} .","top":"Không có chủ đề top.","educate":{"new":"\u003cp\u003eChủ đề mới của bạn sẽ hiển thị ở đây.\u003c/p\u003e\u003cp\u003eMặc định, chủ đề được coi là mới và sẽ hiển thị \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003enew\u003c/span\u003e cho biết chúng đã được tạo ra trong 2 ngày qua.\u003c/p\u003e\u003cp\u003eXem \u003ca href=\"%{userPrefsUrl}\"\u003ethiết lập\u003c/a\u003e của bạn nếu muốn thay đổi.\u003c/p\u003e","unread":"\u003cp\u003eChủ đề chưa đọc của bạn sẽ hiển thị ở đây.\u003c/p\u003e\u003cp\u003eMặc định, chủ đề được coi là chưa đọc và sẽ hiển thị số \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e nếu bạn:\u003c/p\u003e\u003cul\u003e\u003cli\u003eĐã tạo chủ đề\u003c/li\u003e\u003cli\u003eĐã trả lời chủ đề\u003c/li\u003e\u003cli\u003eĐọc chủ đề trong hơn 4 phút\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eHoặc nếu bạn đã thiết lập một cách rõ ràng các chủ đề Theo dõi hoặc Xem thông qua việc kiểm soát thông báo ở dưới cùng của mỗi chủ đề.\u003c/p\u003e\u003cp\u003eXem \u003ca href=\"%{userPrefsUrl}\"\u003ethiết lập\u003c/a\u003e của bạn nếu muốn thay đổi.\u003c/p\u003e"}},"bottom":{"latest":"Không còn thêm chủ đề nào nữa.","posted":"Ở đây không có thêm chủ đề nào được đăng.","read":"Không còn thêm chủ đề chưa đọc nào nữa.","new":"Không còn thêm chủ đề mới nào nữa.","unread":"Không còn thêm chủ đề chưa đọc nào nữa.","category":"Không còn thêm chủ đề nào trong {{category}} .","top":"Không còn của đề top nào nữa.","bookmarks":"Không còn thêm chủ đề được đánh dấu nào nữa."}},"topic":{"create":"Chủ đề Mới","create_long":"Tạo một Chủ đề mới","private_message":"Bắt đầu một thông điệp","archive_message":{"help":"Chuyển tin nhắn sang lưu trữ","title":"Lưu trữ"},"move_to_inbox":{"title":"Chuyển sang hộp thư","help":"Chuyển tin nhắn trở lại hộp thư"},"defer":{"title":"Hoãn"},"list":"Chủ đề","new":"chủ đề mới","unread":"chưa đọc","new_topics":{"other":"{{count}} chủ đề mới."},"unread_topics":{"other":"{{count}} chủ đề chưa đọc."},"title":"Chủ đề","invalid_access":{"title":"Chủ đề này là riêng tư","description":"Xin lỗi, bạn không có quyền truy cập vào chủ đề đó!","login_required":"Bạn cần phải đăng nhập để xem chủ đề đó"},"server_error":{"title":"Tải chủ đề thất bại","description":"Xin lỗi, chúng tôi không thể tải chủ đề, có thể do kết nối có vấn đề. Xin hãy thử lại. Nếu vấn đề còn xuất hiện, hãy cho chúng tôi biết"},"not_found":{"title":"Không tìm thấy chủ đề","description":"Xin lỗi, chúng tôi không thể tìm thấy chủ đề đó. Có lẽ nó đã bị loại bởi mod?"},"total_unread_posts":{"other":"Bạn có {{number}} bài đăng chưa đọc trong chủ đề này"},"unread_posts":{"other":"bạn có {{number}} bài đăng củ chưa đọc trong chủ đề này"},"new_posts":{"other":"có {{count}} bài đăng mới trong chủ đề này từ lần đọc cuối"},"likes":{"other":"có {{count}} thích trong chủ để này"},"back_to_list":"Quay lại danh sách chủ đề","options":"Các lựa chọn chủ đề","show_links":"Hiển thị liên kết trong chủ đề này","toggle_information":"chuyển đổi các chi tiết chủ để","read_more_in_category":"Muốn đọc nữa? Xem qua các chủ đề khác trong {{catLink}} hoặc {{latestLink}}","read_more":"Muốn đọc nữa? {{catLink}} hoặc {{latestLink}}","browse_all_categories":"Duyệt tất cả các hạng mục","view_latest_topics":"xem các chủ đề mới nhất","suggest_create_topic":"Tại sao không tạo một chủ đề mới?","jump_reply_up":"nhảy đến những trả lời trước đó","jump_reply_down":"nhảy tới những trả lời sau đó","deleted":"Chủ đề này đã bị xóa","topic_status_update":{"num_of_hours":"Số giờ:","remove":"Xoá bộ đếm","when":"Khi:"},"auto_update_input":{"tomorrow":"Ngày mai","this_weekend":"Cuối tuần này","next_week":"Tuần tới","next_month":"Tháng t","pick_date_and_time":"Chọn ngày và giờ"},"temp_close":{"title":"Tạm đóng"},"auto_close":{"error":"Hãy nhập giá trị hợp lệ.","based_on_last_post":"Không đóng cho đến khi bài viết cuối cùng trong chủ đề này trở thành bài cũ"},"reminder":{"title":"Nhắc t"},"status_update_notice":{"auto_open":"Chủ đề này sẽ tự động mở trong %{timeLeft}.","auto_close":"Chủ đề này sẽ tự đóng trong %{timeLeft}.","auto_close_based_on_last_post":"Chủ đề này sẽ đóng %{duration} sau trả lời cuối cùng."},"auto_close_title":"Tự động-Đóng các Cài đặt","timeline":{"back":"Quay lại","replies_short":"%{current} / %{total}"},"progress":{"title":"tiến trình của chủ đề","go_top":"trên cùng","go_bottom":"dưới cùng","go":"đi tới","jump_bottom":"nhảy tới bài viết cuối cùng","jump_prompt":"Nhảy đến...","jump_prompt_of":"của %{count} bài viết","jump_bottom_with_number":"nhảy tới bài viết %{post_number}","jump_prompt_or":"hoặc","total":"tổng số bài viết","current":"bài viết hiện tại"},"notifications":{"reasons":{"3_6":"Bạn sẽ nhận được các tin báo bởi vì bạn đang theo dõi chuyên mục này.","3_5":"Bạn sẽ nhận được tin báo bởi vì bạn đã bắt đầu theo dõi chủ đề này một cách tự động.","3_2":"Bạn sẽ nhận được các tin báo bởi vì bạn đang theo dõi chủ đề này.","3_1":"Bạn sẽ được nhận các tin báo bởi bạn đã tạo chủ để này.","3":"Bạn sẽ nhận được các tin báo bởi vì bạn đang theo dõi chủ đề này.","2_8":"Bạn sẽ thấy được 1 số lượng bài viết mới bởi vì bạn đang theo dấu chuyên mục này.","2":"Bạn sẽ xem được các bài trả lời bởi vì bạn \u003ca href=\"{{basePath}}/u/{{username}}/preferences\"\u003eđọc chủ đề này\u003c/a\u003e.","1_2":"Bạn sẽ được tin báo nếu ai đó đề cập đến @tên bạn hoặc trả lời bạn.","1":"Bạn sẽ được tin báo nếu ai đó đề cập đến @tên bạn hoặc trả lời bạn.","0_7":"Bạn đang bỏ qua tất cả các tin báo trong chuyên mục này.","0_2":"Bạn đang bỏ qua tất cả các thông báo trong chủ đề này","0":"Bạn đang bỏ qua tất cả các thông báo trong chủ đề này"},"watching_pm":{"title":"Đang theo dõi","description":"Bạn sẽ được thông báo về từng trả lời mới trong tin nhắn này, và một số trả lời mới sẽ được hiển thị"},"watching":{"title":"Đang theo dõi","description":"Bạn sẽ được thông báo về từng trả lời mới trong tin nhắn này, và một số trả lời mới sẽ được hiển thị"},"tracking_pm":{"title":"Đang theo dõi","description":"Một số trả lời mới sẽ được hiển thị trong tin nhắn này. Bạn sẽ được thông báo nếu ai đó đề cập đến @tên của bạn hoặc trả lời bạn"},"tracking":{"title":"Đang theo dõi","description":"Một số trả lời mới sẽ được hiển thị trong chủ đề này. Bạn sẽ được thông báo nếu ai đó đề cập đến @tên của bạn hoặc trả lời bạn"},"regular":{"title":"Bình thường","description":"Bạn sẽ được thông báo nếu ai đó đề cập đến @tên bạn hoặc trả lời bạn"},"regular_pm":{"title":"Bình thường","description":"Bạn sẽ được thông báo nếu ai đó đề cập đến @tên bạn hoặc trả lời bạn"},"muted_pm":{"title":"Im lặng","description":"Bạn sẽ không bao giờ được thông báo về bất cứ điều gì về tin nhắn này. "},"muted":{"title":"Im lặng","description":"Bạn sẽ không nhận được bất kỳ thông báo nào trong chủ đề này, và chúng sẽ không hiển thị là mới nhất."}},"actions":{"title":"Hành động","recover":"Không-Xóa Chủ Đề Này","delete":"Xóa-Chủ Đề Này","open":"Mở Chủ Đề","close":"Đóng Chủ Đề","multi_select":"Chọn Bài Viết...","pin":"Ghim Chủ Đề...","unpin":"Bỏ-Ghim Chủ Đề...","unarchive":"Chủ đề Không Lưu Trữ","archive":"Chủ Đề Lưu Trữ","invisible":"Make Unlisted","visible":"Make Listed","reset_read":"Đặt lại dữ liệu đọc","make_public":"Công khai chủ đề này"},"feature":{"pin":"Ghim Chủ Đề","unpin":"Bỏ-Ghim Chủ Đề","pin_globally":"Ghim Chủ Đề Tổng Thể","make_banner":"Banner chủ đề","remove_banner":"Bỏ banner chủ đề"},"reply":{"title":"Trả lời","help":"bắt đầu soạn phản hồi cho chủ đề này"},"clear_pin":{"title":"Xóa ghim","help":"Xóa trạng thái ghim của chủ đề này để nó không còn xuất hiện trên cùng danh sách chủ đề của bạn"},"share":{"title":"Chia sẻ","help":"Chia sẻ một liên kết đến chủ đề này"},"print":{"title":"In"},"flag_topic":{"title":"Gắn cờ","help":"đánh dấu riêng tư chủ đề này cho sự chú ý hoặc gửi một thông báo riêng về nó","success_message":"Bạn đã đánh dấu thành công chủ đề này"},"feature_topic":{"title":"Đề cao chủ đề này","pin":"Làm cho chủ đề này xuất hiện trên top của chuyên mục {{categoryLink}}","confirm_pin":"Bạn đã có {{count}} chủ đề được ghim. Qúa nhiều chủ đề được ghim có thể là một trở ngại cho những thành viên mới và thành viên ẩn danh. Bạn có chắc chắn muốn ghim chủ đề khác trong chuyên mục này?","unpin":"Xóa chủ đề này từ phần trên cùng của chủ đề {{categoryLink}}","unpin_until":"Gỡ bỏ chủ đề này khỏi top của chuyên mục {{categoryLink}} và đợi cho đến \u003cstrong\u003e%{until}\u003c/strong\u003e.","pin_note":"Người dùng có thể bỏ ghim chủ đề riêng cho mình","pin_validation":"Ngày được yêu câu để gắn chủ đề này","not_pinned":"Không có chủ đề được ghim trong {{categoryLink}}.","already_pinned":{"other":"Chủ đề gần đây được ghim trong {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"Làm cho chủ đề này xuất hiện trên top của tất cả các chủ đề","confirm_pin_globally":"Bạn đã có {{count}} chủ đề được ghim. Ghim quá nhiều chủ đề có thể là trở ngại cho những thành viên mới và ẩn danh. Bạn có chắc chắn muốn ghim chủ đề khác?","unpin_globally":"Bỏ chủ đề này khỏi phần trên cùng của danh sách tất cả các chủ đề","unpin_globally_until":"Gỡ bỏ chủ đề này khỏi top của danh sách tất cả các chủ đề và đợi cho đến \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"Người dùng có thể bỏ ghim chủ đề riêng cho mình","not_pinned_globally":"Không có chủ đề nào được ghim.","already_pinned_globally":{"other":"Chủ đề gần đây được ghim trong: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"Đặt chủ đề này là một banner xuất hiện trên top của tất cả các trang.","remove_banner":"Gỡ bỏ banner xuất hiện trên top của tất cả các trang.","banner_note":"Người dùng có thể bỏ qua banner này bằng cách đóng nó. Chỉ một chủ đề có thể được đặt là banner tại một thời điểm.","no_banner_exists":"Không có chủ đề banner nào.","banner_exists":"Có \u003cstrong class='badge badge-notification unread'\u003eis\u003c/strong\u003e đang là chủ đề banner."},"inviting":"Đang mời...","invite_private":{"title":"Mời thảo luận","email_or_username":"Email hoặc username người được mời","email_or_username_placeholder":"địa chỉ thư điện tử hoặc tên người dùng","action":"Mời","success":"Chúng tôi đã mời người đó tham gia thảo luận này.","error":"Xin lỗi, có lỗi khi mời người dùng này.","group_name":"Nhóm tên"},"controls":"Topic Controls","invite_reply":{"title":"Mời","username_placeholder":"tên người dùng","action":"Gửi Lời Mời","help":"mời người khác tham gia chủ đề thông qua email hoặc thông báo","to_forum":"Chúng tôi sẽ gửi một email tóm tắt cho phép bạn của bạn gia nhập trực tiệp bằng cách nhấp chuột vào một đường dẫn, không cần phải đăng nhập.","sso_enabled":"Nhập tên đăng nhập hoặc địa chỉ email của người mà bạn muốn mời vào chủ đề này.","to_topic_blank":"Nhập tên đăng nhập hoặc địa chỉ email của người bạn muốn mời đến chủ đề này.","to_topic_email":"Bạn vừa điền địa chỉ email, website sẽ gửi lời mời cho phép bạn bè của bạn có thể trả lời chủ đề này.","to_topic_username":"Bạn vừa điền tên thành viên, website sẽ gửi thông báo kèm theo lời mời họ tham gia chủ đề này.","to_username":"Điền tên thành viên bạn muốn mời, website sẽ gửi thông báo kèm theo lời mời họ tham gia chủ đề này.","email_placeholder":"name@example.com","success_email":"Website vừa gửi lời mời tới \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e và sẽ thông báo cho bạn khi lời mời đó được chấp nhận. Kiểm tra tab lời mời trên trang tài khoản để theo dõi lời mời của bạn.","success_username":"Website đã mời người đó tham gia thảo luận này.","error":"Xin lỗi, chúng tôi không thể mời người đó. Có lẽ họ đã được mời? (giới hạn lời mời)"},"login_reply":"Đăng nhập để trả lời","filters":{"n_posts":{"other":"{{count}} bài viết"},"cancel":"Bỏ đièu kiện lọc"},"split_topic":{"title":"Di chuyển tới Chủ đề mới","action":"di chuyển tới chủ đề mới","radio_label":"Chủ đề Mới","error":"Có lỗi khi di chuyển bài viết tới chủ đề mới.","instructions":{"other":"Bạn muốn tạo chủ đề mới và phổ biến nó với \u003cb\u003e{{count}}\u003c/b\u003e bài viết đã chọn."}},"merge_topic":{"title":"Di chuyển tới chủ đề đang tồn tại","action":"di chuyển tới chủ đề đang tồn tại","error":"Có lỗi khi di chuyển bài viết đến chủ đề này.","instructions":{"other":"Hãy chọn chủ đề bạn muốn di chuyển \u003cb\u003e{{count}}\u003c/b\u003e bài viết này tới."}},"move_to_new_message":{"radio_label":"Tin nhắn mới"},"change_owner":{"action":"chuyển chủ sở hữu","error":"Có lỗi xảy ra khi thay đổi quyền sở hữu của các bài viết.","placeholder":"tên đăng nhập của chủ sở hữu mới"},"change_timestamp":{"action":"đổi timestamp","invalid_timestamp":"Timestamp không thể trong tương lai.","error":"Có lỗi khi thay đổi timestamp của chủ đề.","instructions":"Hãy chọn dòng thời gian mới cho chủ đề, các bài viết trong chủ đề sẽ được cập nhật để có sự khác biệt cùng một lúc."},"multi_select":{"select":"chọn","selected":"đã chọn ({{count}})","select_post":{"label":"chọn"},"select_replies":{"label":"chọn + trả lời"},"delete":"xóa lựa chọn","cancel":"hủy lựa chọn","select_all":"chọn tất cả","deselect_all":"bỏ chọn tất cả","description":{"other":"Bạn đã chọn \u003cb\u003e{{count}}\u003c/b\u003e bài viết."}}},"post":{"quote_reply":"Trích dẫn","edit_reason":"Lý do: ","post_number":"bài viết {{number}}","last_edited_on":"đã sửa bài viết lần cuối lúc","reply_as_new_topic":"Trả lời như là liên kết đến Chủ đề","continue_discussion":"Tiếp tục thảo luận từ {{postLink}}:","follow_quote":"đến bài viết trích dẫn","show_full":"Hiển thị đầy đủ bài viết","deleted_by_author":{"other":"(bài viết theo tác giả sẽ được xóa tự động sau %{count} giờ, trừ khi đã đánh dấu)"},"expand_collapse":"mở/đóng","gap":{"other":"xem {{count}} trả lời bị ẩn"},"unread":"Bài viết chưa đọc","has_replies":{"other":"{{count}} Trả lời"},"has_likes_title":{"other":"{{count}} người thích bài viết này"},"has_likes_title_only_you":"bạn đã like bài viết này","has_likes_title_you":{"other":"bạn và {{count}} người khác đã like bài viết này"},"errors":{"create":"Xin lỗi, có lỗi xảy ra khi tạo bài viết của bạn. Vui lòng thử lại.","edit":"Xin lỗi, có lỗi xảy ra khi sửa bài viết của bạn. Vui lòng thử lại.","upload":"Xin lỗi, có lỗi xảy ra khi tải lên tập tin này. Vui lòng thử lại.","too_many_uploads":"Xin lỗi, bạn chỉ có thể tải lên 1 file cùng 1 lúc.","image_upload_not_allowed_for_new_user":"Xin lỗi, tài khoản mới không thể tải lên ảnh.","attachment_upload_not_allowed_for_new_user":"Xin lỗi, tài khoản mới không thể tải lên đính kèm.","attachment_download_requires_login":"Xin lỗi, bạn cần đăng nhập để tải về đính kèm."},"abandon_edit":{"no_value":"Không, giữ lại"},"abandon":{"confirm":"Bạn có chắc muốn bỏ bài viết của bạn?","no_value":"Không, giữ lại","yes_value":"Đồng ý, bỏ"},"via_email":"bài viết này đăng qua email","whisper":"bài viết này là lời nhắn từ điều hành viên","wiki":{"about":"Bài viết này là một wiki"},"archetypes":{"save":"Lưu lựa chọn"},"few_likes_left":"Cám ơn bạn đã chia sẻ cảm nhận! Bạn chỉ còn lại vài lượt like cho ngày hôm nay.","controls":{"reply":"bắt đầu soản trả lời cho bài viết này","like":"like bài viết này","has_liked":"bạn đã thích bài viết này","undo_like":"hủy like","edit":"sửa bài viết này","edit_action":"Sửa","edit_anonymous":"Xin lỗi, nhưng bạn cần đăng nhập để sửa bài viết này.","flag":"đánh dấu bài viết này để tạo chú ý hoặc gửi một thông báo riêng về nó","delete":"xóa bài viết này","undelete":"hủy xóa bài viết này","share":"chia sẻ liên kết đến bài viết này","more":"Thêm","delete_replies":{"just_the_post":"Không, chỉ xóa chủ đề"},"admin":"quản lý bài viết","wiki":"Tạo Wiki","unwiki":"Xóa Wiki","convert_to_moderator":"Thêm màu Nhân viên","revert_to_regular":"Xóa màu Nhân viên","rebake":"Tạo lại HTML","unhide":"Bỏ ẩn","change_owner":"Đổi chủ sở hữu","grant_badge":"Cấp huy hiệu","delete_topic":"xóa chủ đề"},"actions":{"flag":"Gắn cờ","undo":{"off_topic":"Hủy gắn cờ","spam":"Hủy gắn cờ","inappropriate":"Hủy gắn cờ","bookmark":"Hủy đánh dấu","like":"Hủy like"},"people":{"off_topic":"đánh dấu là chủ đề đóng","spam":"đánh dấu là spam","inappropriate":"đánh dấu là không phù hợp","notify_moderators":"đã thông báo với BQT","notify_user":"đã gửi tin nhắn","bookmark":"đã đánh dấu bài này","like":{"other":"thích này"},"like_capped":{"other":"và {{count}} người khác thích nầy"}},"by_you":{"off_topic":"Bạn đã đánh dấu cái nfay là chủ đề đóng","spam":"Bạn đã đánh dấu cái này là rác","inappropriate":"Bạn đã đánh dấu cái này là không phù hợp","notify_moderators":"Bạn đã đánh dấu cái này cho điều tiết","notify_user":"Bạn đã gửi một tin nhắn đến người dùng này","bookmark":"Bạn đã đánh dấu bài viết này","like":"Bạn đã thích cái này"}},"revisions":{"controls":{"first":"Sửa đổi đầu tiên","previous":"Sửa đổi trước","next":"Sửa đổi tiếp theo","last":"Sửa đổi gần nhất","hide":"Ẩn sửa đổi","show":"Hiện sửa đổi","revert":"Hoàn nguyên sửa đổi","edit_wiki":"Sửa wiki","edit_post":"Sửa bài đăng"},"displays":{"inline":{"title":"Hiển thị dạng xuất kèm theo các bổ sung và loại bỏ nội tuyến","button":"HTML"},"side_by_side":{"title":"Hiển thị dạng xuất với các điểm khác biệt cạnh nhau","button":"HTML"},"side_by_side_markdown":{"title":"Hiển thị nguyên bản với các điểm khác biệt cạnh nhau","button":"Thô"}}},"raw_email":{"displays":{"raw":{"button":"Thô"},"text_part":{"button":"Văn bản"},"html_part":{"button":"HTML"}}},"bookmarks":{"created":"Tạo bởi","name":"Tên"}},"category":{"can":"can\u0026hellip;","none":"(không danh mục)","all":"Tất cả danh mục","edit":"Sửa","view":"Xem Chủ đề trong Danh mục","general":"Chung","settings":"Cấu hình","topic_template":"Mẫu Chủ đề","tags":"Thẻ","tags_placeholder":"(Tuỳ chọn) danh sách thẻ cho phép","delete":"Xóa chuyên mục","create":"Chuyên mục mới","create_long":"Tạo Chủ đề mới","save":"Lưu chuyên mục","slug":"Đường dẫn chuyên mục","slug_placeholder":"(Tùy chọn) các từ sử dụng trong url","creation_error":"Có lỗi xảy ra khi tạo chuyên mục","save_error":"Có lỗi xảy ra khi lưu chuyên mục","name":"Tên chuyên mục","description":"Mô tả","topic":"chủ đề chuyên mục","logo":"Logo của chuyên mục","background_image":"Ảnh nền của chuyên mục","badge_colors":"Màu huy hiệu","background_color":"Màu nền","foreground_color":"Màu mặt trước","name_placeholder":"Tối đa một hoặc hai từ","color_placeholder":"Bất cứ màu nào","delete_confirm":"Bạn có chắc sẽ xóa chuyên mục này chứ?","delete_error":"Có lỗi xảy ra khi xóa chuyên mục này","list":"Danh sách chuyên mục","no_description":"Hãy thêm mô tả cho chuyên mục này","change_in_category_topic":"Sửa mô tả","already_used":"Màu này đã được dùng bởi chuyên mục khác","security":"Bảo mật","special_warning":"Cảnh báo: Đây là chuyên mục có sẵn nên bạn không thể chỉnh sửa các thiết lập bảo mật. Nếu bạn muốn sử dụng chuyên mục này, hãy xóa nó thay vì tái sử dụng.","images":"Hình ảnh","email_in":"Tùy chỉnh địa chỉ nhận thư điện tử ","email_in_allow_strangers":"Nhận thư điện tử từ người gửi vô danh không tài khoản","email_in_disabled":"Tạo chủ đề mới thông qua email đã được tắt trong thiết lập. Để bật tính năng này, ","email_in_disabled_click":"kích hoạt thiết lập thư điện tử","allow_badges_label":"Cho phép thưởng huy hiệu trong chuyên mục này","edit_permissions":"Sửa quyền","review_group_name":"Nhóm tên","this_year":"năm nay","default_position":"vị trí mặc định","position_disabled":"Chuyên mục sẽ được hiển thị theo thứ tự hoạt động. Để kiểm soát thứ tự chuyên mục trong danh sách, ","position_disabled_click":"bật thiết lập \"cố định vị trí chuyên mục\".","parent":"Danh mục cha","notifications":{"watching":{"title":"Theo dõi"},"watching_first_post":{"title":"Xem bài viết đầu tiên"},"tracking":{"title":"Đang theo dõi"},"regular":{"title":"Bình thường","description":"Bạn sẽ được thông báo nếu ai đó đề cập đến @tên bạn hoặc trả lời bạn"},"muted":{"title":"Im lặng","description":"Bạn sẽ không nhận được thông báo về bất cứ chủ đề mới nào trong các chuyên mục này, và chúng sẽ không hiển thị là mới nhất."}},"search_priority":{"options":{"normal":"Bình thường","ignore":"Bỏ qua","high":"Cao"}},"sort_options":{"default":"mặc định","likes":"Thích","views":"Lượt xem","posts":"Bài viết","activity":"Hoạt động","posters":"Người gửi","category":"Chuyên mục","created":"Được tạo","votes":"Bình chọn"},"sort_ascending":"Tăng dần","sort_descending":"Giảm dần","settings_sections":{"general":"Chung","email":"Email"}},"flagging":{"title":"Cám ơn bạn đã giúp phát triển cộng đồng!","action":"Đánh dấu Bài viết","take_action":"Thực hiện","notify_action":"Tin nhắn","official_warning":"Cảnh báo chính thức","delete_spammer":"Xóa người Spam","yes_delete_spammer":"Có, xóa người spam","ip_address_missing":"(N/A)","hidden_email_address":"(ẩn)","submit_tooltip":"Đánh dấu riêng tư","take_action_tooltip":"Tiếp cận ngưỡng đánh dấu ngay lập tức, thay vì đợi cộng đồng","cant":"Xin lỗi, bạn không thể đánh dấu bài viết lúc này.","notify_staff":"Thông báo riêng cho BQT","formatted_name":{"off_topic":"Nó là sai chủ đề","inappropriate":"Không phù hợp","spam":"Nó là rác"},"custom_placeholder_notify_user":"Phải hảo tâm và mang tính xây dựng.","custom_placeholder_notify_moderators":"Hãy cho chúng tôi biết cụ thể những gì bạn quan tâm, và cung cấp các liên kết hoặc ví dụ liên quan nếu có thể.","custom_message":{"at_least":{"other":"nhập ít nhất {{count}} kí tự"},"left":{"other":"{{count}} còn lại"}}},"flagging_topic":{"title":"Cám ơn bạn đã giúp phát triển cộng đồng!","action":"Gắn cờ Chủ đề","notify_action":"Tin nhắn"},"topic_map":{"title":"Tóm tắt Chủ đề","participants_title":"Poster thường xuyên","links_title":"Liên kết phổ biến","links_shown":"hiển thị thêm liên kết...","clicks":{"other":"%{count} nhấp chuột"}},"post_links":{"title":{"other":"%{count} thêm"}},"topic_statuses":{"warning":{"help":"Đây là một cảnh báo chính thức."},"bookmarked":{"help":"Bạn đã đánh dấu chủ đề này"},"locked":{"help":"Chủ đề đã đóng; không cho phép trả lời mới"},"archived":{"help":"Chủ đề này đã được lưu trữ, bạn không thể sửa đổi nữa"},"locked_and_archived":{"help":"Chủ đề này đã đóng và lưu trữ, không cho phép trả lời mới và sửa đổi nữa"},"unpinned":{"title":"Hủy gắn","help":"Chủ đề này không còn được ghim nữa, nó sẽ hiển thị theo thứ tự thông thường"},"pinned_globally":{"title":"Ghim toàn trang","help":"Chủ đề này được ghim toàn trang, nó sẽ hiển thị ở trên cùng các chủ đề mới và trong chuyên mục"},"pinned":{"title":"Gắn","help":"Chủ đề này đã được ghim, nó sẽ hiển thị ở trên cùng chuyên mục"},"unlisted":{"help":"Chủ đề này ẩn, nó sẽ không hiển thị trong danh sách chủ đề, và chỉ có thể truy cập thông qua liên kết trực tiếp"}},"posts":"Bài viết","posts_long":"Có {{number}} bài đăng trong chủ đề này","original_post":"Bài viết gốc","views":"Lượt xem","views_lowercase":{"other":"lượt xem"},"replies":"Trả lời","views_long":{"other":"chủ đề này đã được xem {{number}} lần"},"activity":"Hoạt động","likes":"Lượt thích","likes_lowercase":{"other":"lượt thích"},"likes_long":"Có {{number}} thích trong chủ đề này","users":"Người dùng","users_lowercase":{"other":"người dùng"},"category_title":"Danh mục","history":"Lịch sử","changed_by":"bởi {{author}}","raw_email":{"not_available":"Không sẵn sàng!"},"categories_list":"Danh sách Danh mục","filters":{"with_topics":"%{filter} chủ đề","with_category":"%{filter} %{category} chủ đề","latest":{"title":"Mới nhất","title_with_count":{"other":"Mới nhất ({{count}})"},"help":"chủ đề với bài viết gần nhất"},"read":{"title":"Đọc","help":"chủ đề bạn đã đọc, theo thứ tự bạn đọc lần cuối cùng"},"categories":{"title":"Danh mục","title_in":"Danh mục - {{categoryName}}","help":"tất cả các chủ đề được nhóm theo chuyên mục"},"unread":{"title":"Chưa đọc","title_with_count":{"other":"Chưa đọc ({{count}})"},"help":"chủ đề bạn đang xem hoặc theo dõi có bài viết chưa đọc","lower_title_with_count":{"other":"{{count}} chưa đọc"}},"new":{"lower_title_with_count":{"other":"{{count}} mới"},"lower_title":"mới","title":"Mới","title_with_count":{"other":"Mới ({{count}})"},"help":"chủ đề đã tạo cách đây vài ngày"},"posted":{"title":"Bài viết của tôi","help":"chủ đề của bạn đã được đăng trong"},"bookmarks":{"title":"Đánh dấu","help":"chủ để của bạn đã được đánh dấu"},"category":{"title":"{{categoryName}}","title_with_count":{"other":"{{categoryName}} ({{count}})"},"help":"Những chủ đề mới nhất trong chuyên mục{{categoryName}} "},"top":{"title":"Top","help":"Các chủ đề tích cực nhất trong năm, tháng, tuần, hoặc ngày trước","all":{"title":"Từ trước tới nay"},"yearly":{"title":"Hàng năm"},"quarterly":{"title":"Hàng quý"},"monthly":{"title":"Hàng tháng"},"weekly":{"title":"Hàng tuần"},"daily":{"title":"Hàng ngày"},"all_time":"Từ trước tới nay","this_year":"Năm","this_quarter":"Quý","this_month":"Tháng","this_week":"Tuần","today":"Ngày","other_periods":"xem top"},"votes":{"title":"Bình chọn","help":"chủ đề có nhiều bình chọn nhất"}},"permission_types":{"full":"Tạo / Trả lời / Xem","create_post":"Trả lời / Xem","readonly":"Xem"},"lightbox":{"download":"tải về"},"keyboard_shortcuts_help":{"title":"Phím tắt","jump_to":{"title":"Nhảy đến","home":"%{shortcut} Nhà","latest":"%{shortcut} Cuối cùng","new":"%{shortcut} Mới","unread":"%{shortcut} Chưa đọc","categories":"%{shortcut} Danh mục","top":"%{shortcut} Trên","bookmarks":"%{shortcut} Đánh dấu","profile":"%{shortcut} Hồ sơ","messages":"%{shortcut} Tin nhắn"},"navigation":{"title":"Điều hướng","jump":"%{shortcut} Đến bài viết #","back":"%{shortcut} Quay lại","up_down":"%{shortcut} Move selection \u0026uarr; \u0026darr;","open":"%{shortcut} Mở chủ để đã chọn","next_prev":"%{shortcut} Next/previous section"},"application":{"title":"Ứng dụng","create":"%{shortcut} Tạo mới chủ đề","notifications":"%{shortcut} Mở thông báo","hamburger_menu":"%{shortcut} Mở menu mobile","user_profile_menu":"%{shortcut} Mở trình đơn thành viên","show_incoming_updated_topics":"%{shortcut} Show updated topics","help":"%{shortcut} Mở trợ giúp bàn phím","dismiss_new_posts":"%{shortcut} Dismiss New/Posts","dismiss_topics":"%{shortcut} Bỏ qua bài viết","log_out":"%{shortcut} Đăng xuất"},"actions":{"title":"Hành động","bookmark_topic":"%{shortcut} Chuyển chủ đề đánh dấu","pin_unpin_topic":"%{shortcut} Pin/Unpin bài viết","share_topic":"%{shortcut} Chia sẻ bài viết","share_post":"%{shortcut} Chia sẻ bài viết","reply_as_new_topic":"%{shortcut} Trả lời như là một liên kết đến bài viết","reply_topic":"%{shortcut} Trả lời bài viết","reply_post":"%{shortcut} Trả lời bài viết","quote_post":"%{shortcut} Trích dẫn bài viết","like":"%{shortcut} Thích bài viết","flag":"%{shortcut} Đánh dấu bài viết","bookmark":"%{shortcut} Đánh dấu bài viết","edit":"%{shortcut} Sửa bài viết","delete":"%{shortcut} Xóa bài viết","mark_muted":"%{shortcut} Mute topic","mark_regular":"%{shortcut} Chủ đề thông thường (mặc định)","mark_tracking":"%{shortcut} Theo dõi chủ đề","mark_watching":"%{shortcut} theo dõi chủ đề"}},"badges":{"earned_n_times":{"other":"Đã giành được huy hiệu này %{count} lần"},"granted_on":"Cấp ngày %{date}","others_count":"Người có huy hiệu này (%{count})","title":"Huy hiệu","badge_count":{"other":"%{count} huy hiệu"},"select_badge_for_title":"Chọn huy hiệu để sử dụng như là tên","none":"(không có gì)","badge_grouping":{"getting_started":{"name":"Bắt đầu"},"community":{"name":"Cộng đồng"},"trust_level":{"name":"Cấp độ tin tưởng"},"other":{"name":"Khác"},"posting":{"name":"Gửi bài"}}},"tagging":{"all_tags":"Tất cả thẻ","selector_all_tags":"tất cả thẻ","selector_no_tags":"không có thẻ","changed":"thẻ đã đổi:","tags":"Thẻ","add_synonyms":"Thêm","delete_tag":"Xoá thẻ","rename_tag":"Đổi tên thẻ","rename_instructions":"Chọn tên mới cho thẻ:","sort_by":"Xếp theo:","sort_by_count":"đếm","sort_by_name":"tên","cancel_delete_unused":"Hủy","filters":{"untagged_without_category":"%{filter} chủ đề chưa được gắn thẻ","untagged_with_category":"%{filter} chủ đề chưa được gắn thẻ trong %{category}"},"notifications":{"watching":{"title":"Đang theo dõi"},"watching_first_post":{"title":"Xem bài viết đầu tiên"},"tracking":{"title":"Đang theo dõi"},"regular":{"title":"Thường xuyên"},"muted":{"title":"Im lặng"}},"groups":{"new":"Nhóm mới","tags_label":"Thẻ trong nhóm này:","parent_tag_label":"Thẻ cha:","parent_tag_placeholder":"Tuỳ chọn","save":"Lưu","delete":"Xoá"},"topics":{"none":{"unread":"Bạn không có chủ đề chưa đọc này","new":"Bạn không có chủ đề mới","read":"Bạn chưa đọc chủ đề nào","posted":"Bạn chưa gửi bài trong bất kì chủ đề nào","latest":"Không có chủ đề mới nhất","bookmarks":"Bạn chưa chủ đề nào được đánh dấu.","top":"Không có chủ đề top."},"bottom":{"latest":"Không còn thêm chủ đề nào nữa.","posted":"Ở đây không có thêm chủ đề nào được đăng.","read":"Không còn thêm chủ đề chưa đọc nào nữa.","new":"Không còn thêm chủ đề mới nào nữa.","unread":"Không còn thêm chủ đề chưa đọc nào nữa.","top":"Không còn của đề top nào nữa.","bookmarks":"Không còn thêm chủ đề được đánh dấu nào nữa."}}},"poll":{"voters":{"other":"người bình chọn"},"total_votes":{"other":"tổng số bình chọn"},"average_rating":"Trung bình: \u003cstrong\u003e%{average}\u003c/strong\u003e.","public":{"title":"Bình chọn \u003cstrong\u003ecông khai\u003c/strong\u003e"},"multiple":{"help":{"at_least_min_options":{"other":"Chọn ít nhất \u003cstrong\u003e%{count}\u003c/strong\u003e lựa chọn"},"up_to_max_options":{"other":"Chọn tối đa \u003cstrong\u003e%{count}\u003c/strong\u003e lựa chọn"},"x_options":{"other":"Chọn \u003cstrong\u003e%{count}\u003c/strong\u003e lựa chọn"},"between_min_and_max_options":"Chọn giữa \u003cstrong\u003e%{min}\u003c/strong\u003e và \u003cstrong\u003e%{max}\u003c/strong\u003e lựa chọn."}},"cast-votes":{"title":"Thay đổi bình chọn của bạn","label":"Bình chọn ngay!"},"show-results":{"title":"Hiển thị kết quả thăm dò","label":"Hiện kết quả"},"hide-results":{"title":"Trở lại bình chọn của bạn"},"export-results":{"label":"Xuất"},"open":{"title":"Mở thăm dò","label":"Mở","confirm":"Bạn có muốn mở thăm dò này?"},"close":{"title":"Đóng thăm dò","label":"Đóng","confirm":"Bạn có muốn đóng thăm dò này ?"},"error_while_toggling_status":"Đã có lỗi xảy ra khi chuyển trạng thái của thăm dò.","error_while_casting_votes":"Đã có lỗi xảy ra làm ảnh hưởng đến bình chọn của bạn.","error_while_fetching_voters":"Đã có lỗi xảy ra khi hiển thị những người tham gia bình chọn.","ui_builder":{"title":"Tạo thăm dò","insert":"Chèn thăm dò","help":{"invalid_values":"Giá trị nhỏ nhất phải nhỏ hơn giá trị lớn nhất.","min_step_value":"Khoảng cách tối thiểu là 1"},"poll_type":{"label":"Loại","regular":"Một lựa chọn","multiple":"Nhiều lựa chọn","number":"Xếp hạng"},"poll_result":{"label":"Kết quả"},"poll_config":{"max":"Tối đa","min":"Tối thiểu","step":"Bước"},"poll_public":{"label":"Hiển thị người đã bình chọn"},"poll_options":{"label":"Nhập mỗi lựa chọn trong thăm dò vào một dòng"}}},"discourse_narrative_bot":{"welcome_post_type":{"new_user_track":"Bật hướng dẫn cho tất cả người dùng mới","welcome_message":"Gửi tin nhắn chào mừng cho tất cả thành viên mới kèm theo hướng dẫn bắt đầu."}},"discourse_local_dates":{"create":{"form":{"date_title":"ày","time_title":"Thời gian","timezone":"Múi giờ"}}},"details":{"title":"Ẩn thông tin"},"presence":{"replying":"Đang trả lời","editing":"Đang chỉnh sửa"},"voting":{"title":"Bình chọn","reached_limit":"Bạn đã hết lượt bình chọn, hãy xóa lượt đang có của bạn","list_votes":"Liệt kê bình chọn của bạn","votes_nav_help":"chủ đề có nhiều bình chọn nhất","voted":"Bạn đã bình chọn cho chủ đề này","allow_topic_voting":"Cho phép người dùng bình chọn chủ đề trong chuyên mục này","vote_title":"Bình chọn","vote_title_plural":"Bình ch","voted_title":"Đã bình ch","voting_closed_title":"Đã ","voting_limit":"Giới h","votes_left":{"other":"Bạn còn {{count}}phiếu, xem \u003ca href='{{path}}'\u003elượt bầu\u003c/a\u003e của bạn"},"votes":{"other":"{{count}}phiếu"},"anonymous_button":{"other":"Phiếu"},"remove_vote":"Xoá Bình Chọn\u003cbr\u003e"},"adplugin":{"advertisement_label":"QUẢNG CÁO"},"docker":{"upgrade":"Có bản cập nhật mới cho Discourse.","perform_upgrade":"Nhấn vào đây để cập nhật"}}},"zh_CN":{"js":{"dates":{"long_no_year":"M[月]D[日] HH:mm"},"action_codes":{"forwarded":"转发上述邮件"},"bookmarked":{"help":{"unbookmark_with_reminder":"点击以移除该主题上的所有收藏和提醒。你在该主题中设定了一个于%{reminder_at}的提醒。"}},"bookmarks":{"created_with_reminder":"你已经收藏该帖并且设定了一个于%{date}的提醒","created_with_at_desktop_reminder":"你所收藏的此帖将会在你下次使用桌面设备时被提醒。","delete":"删除收藏","confirm_delete":"你确定要删除该收藏吗？你所设置的提醒也会被一并删除。","invalid_custom_datetime":"你所提供的日期和时间无效，请重试。","list_permission_denied":"你没有权限查看该用户的收藏。","reminders":{"later_today":"今天的某个时候","next_business_day":"下一个工作日","later_this_week":"这周的某个时候","start_of_next_business_week":"下周一","last_custom":"最近","none":"无需提醒","today_with_time":"今天%{time}","tomorrow_with_time":"明天%{time}","at_time":"于%{date_time}","existing_reminder":"你为该收藏所设定的提醒将被发出"}},"directory":{"last_updated":"最近更新："},"groups":{"requests":{"handle":"处理成员请求"},"allow_membership_requests":"允许用户向群组所有者发送成员资格请求（需要公开可见的群组）"},"user":{"user_notifications":{"ignore_duration_note":"请注意所有忽略的项目会在忽略的时间段过去后被自动移除","ignore_duration_time_frame_required":"请选择时间范围","ignore_option_title":"你将不会收到关于此用户的通知并且隐藏其所有帖子及回复。","mute_option_title":"你不会收到任何关于此用户的通知","normal_option_title":"如果用户回复、引用或提到你，你将会收到消息。"},"feature_topic_on_profile":{"clear":{"warning":"你确定要清除精选主题吗？"}},"use_current_timezone":"使用现在的时区","profile_hidden":"此用户公共信息已被隐藏。","desktop_notifications":{"label":"实时通知","consent_prompt":"有回复时是否接收通知？"},"text_size_default_on_all_devices":"将其设为我所有设备上的默认字体大小","allow_private_messages":"允许其他用户发送私信给我","enable_defer":"启用延迟以标记未读主题","featured_topic":"精选主题","silenced_tooltip":"该用户已被禁言。","mailing_list_mode":{"warning":"邮件列表模式启用。邮件通知设置被覆盖。"},"tracked_categories_instructions":"你将自动跟踪这些分类中的所有主题。新帖数量将会显示在主题旁边。","muted_categories_instructions":"你不会收到有关这些分类中新主题的任何通知，也不会出现在类别或最新页面上。","muted_categories_instructions_dont_hide":"你将不会收到在这些分类中的新主题通知。","no_category_access":"无法保存，作为审核人你仅具有受限的 分类 访问权限","delete_yourself_not_allowed":"想删除账户请联系管理人员。","ignored_users_instructions":"封禁所有来自这些用户的帖子和通知。","staged":"暂存","staff_counters":{"rejected_posts":"被驳回的帖子"},"second_factor_backup":{"title":"两步备份码","manage":"管理备份码。你还剩下\u003cstrong\u003e{{count}}\u003c/strong\u003e个备份码。","enable_prerequisites":"你必须在生成备份代码之前启用主要第二因素。","codes":{"title":"备份码生成","description":"每个备份码只能使用一次。请存放于安全可读的地方。"}},"second_factor":{"enable":"管理两步验证","forgot_password":"忘记密码？","confirm_password_description":"请确认密码后继续","label":"编码","rate_limit":"请等待另一个验证码。","enable_description":"使用我们支持的应用 (\u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target=\"_blank\"\u003eAndroid\u003c/a\u003e – \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\" target=\"_blank\"\u003eiOS\u003c/a\u003e) 扫描此二维码并输入您的授权码。\n","disable_description":"请输入来自 app 的验证码","short_description":"使用一次性安全码保护你的账户。\n","extended_description":"双重验证要求你的密码之外的一次性令牌，从而为你的账户增加了额外的安全性。可以在\u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target='_blank'\u003eAndroid\u003c/a\u003e和\u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\"\u003eiOS\u003c/a\u003e设备上生成令牌。\n","use":"使用身份验证器应用","enforced_notice":"在访问此站点之前，你需要启用双重身份验证。","disable":"停用","disable_title":"禁用次要身份验证器","disable_confirm":"确定禁用所有的两步验证吗？","edit_title":"编辑次要身份验证器","edit_description":"次要身份验证器名称","enable_security_key_description":"当你准备好物理安全密钥后，请按下面的“注册”按钮。","totp":{"title":"基于凭证的身份验证器","add":"新增身份验证器","name_and_code_required_error":"你必须提供你的身份验证器应用的名称和代码。"},"security_key":{"register":"注册","title":"安全密钥","add":"注册安全密钥","default_name":"主要安全密钥","not_allowed_error":"安全密钥注册过程已超时或被取消。","already_added_error":"你已注册此安全密钥，无需再次注册。","edit":"编辑安全密钥","edit_description":"安全密钥名称","name_required_error":"你必须提供安全密钥的名称。"}},"change_username":{"confirm":"你确定要更改用户名吗？"},"change_email":{"success_staff":"我们已经发送了一封确认信到你现在的邮箱，请按照邮件内指示完成确认。"},"change_avatar":{"gravatar":"\u003ca href='//{{gravatarBaseUrl}}{{gravatarLoginUrl}}' target='_blank'\u003e{{gravatarName}}\u003c/a\u003e，基于","gravatar_title":"在{{gravatarName}}网站修改你的头像","gravatar_failed":"我们无法找到此电子邮件的{{gravatarName}}。","refresh_gravatar_title":"刷新你的{{gravatarName}}"},"change_profile_background":{"title":"个人档头部","instructions":"个人资料的页头会被居中显示且默认宽度为1110px。"},"change_featured_topic":{"title":"精选主题","instructions":"此主题的链接会显示在你的用户卡片和资料中。"},"email":{"sso_override_instructions":"电子邮件地址可以通过SSO登录来更新。"},"associated_accounts":{"title":"关联账户","confirm_description":{"account_specific":"你的%{provider}帐号“%{account_description}”会被用作认证。","generic":"你的%{provider}帐号会被用作认证。"}},"invite_code":{"title":"邀请码","instructions":"账户注册需要邀请码"},"auth_tokens":{"was_this_you_description":"如果不是你，我们建议你更改密码并在任何地方注销。","browser_and_device":"{{browser}}在{{device}}"},"hide_profile_and_presence":"隐藏我的公开个人资料和状态功能","enable_physical_keyboard":"在iPad上启用物理键盘支持","title_count_mode":{"title":"背景页面标题显示计数："},"email_digests":{"title":"长期未访问时发送热门主题和回复的摘要邮件"},"email_level":{"only_when_away":"只在离开时"},"notification_level_when_replying":"当我在主题中回复后，将主题设置至","invited":{"rescind_all":"移除所有过期邀请","rescinded_all":"所有过期邀请已删除！","rescind_all_confirm":"你确定你想要移除所有过期邀请么？","bulk_invite":{"none":"你还没有邀请任何人。你可以单独邀请用户，也可以通过\u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003e上传CSV文件\u003c/a\u003e批量邀请。","confirmation_message":"你将通过电子邮件将邀请发送给在上传的文件中的每一个人。"}},"summary":{"most_replied_to_users":"最多回复至","top_categories":"热门分类"}},"modal":{"dismiss_error":"忽略错误"},"logs_error_rate_notice":{},"time_read_recently":"最近 %{time_read}","time_read_tooltip":"合计阅读时间 %{time_read}","time_read_recently_tooltip":"总阅读时间 %{time_read}（最近60天 %{recent_time_read}）","signup_cta":{"intro":"你好！看起来你正在享受讨论，但还没有注册一个账户。","value_prop":"当你创建了账户，我们就可以准确地记录你的阅读进度，你再次访问时就可以回到之前离开的地方。当有人回复你，你可以通过这里或电子邮件收到通知。并且你还可以通过点赞帖子向他人分享你的喜爱之情。:heartbeat:"},"private_message_info":{"invite":"邀请其他人...","leave_message":"你真的想要发送消息么？"},"forgot_password":{"complete_username_found":"我们找到一个与用户名\u003cb\u003e%{username}\u003c/b\u003e匹配的账户。你应该会收到一封说明如何重设密码的电子邮件。","complete_email_found":"我们找到一个与\u003cb\u003e%{email}\u003c/b\u003e相匹配的账户。你应该会收到一封说明如何重设密码的电子邮件。","help":"没收到邮件？请先查看你的垃圾邮件文件夹。\u003cp\u003e不确定使用了哪个邮箱地址？输入邮箱地址来查看是否存在。\u003c/p\u003e\u003cp\u003e如果你已无法进入你账户的邮箱，请联系\u003ca href='%{basePath}/about'\u003e我们的工作人员。\u003c/a\u003e\u003c/p\u003e"},"email_login":{"logging_in_as":"用%{email}登录"},"login":{"second_factor_backup":"使用备用码登录","second_factor_backup_title":"两步验证备份","second_factor_backup_description":"请输入你的备份码：","second_factor":"使用身份验证器app登录","security_key_description":"当你准备好物理安全密钥后，请按下面的“使用安全密钥进行身份验证”按钮。","security_key_alternative":"尝试另一种方式","security_key_authenticate":"使用安全密钥进行身份验证","security_key_not_allowed_error":"安全密钥验证超时或被取消。","security_key_no_matching_credential_error":"在提供的安全密钥中找不到匹配的凭据。","security_key_support_missing_error":"您当前的设备或浏览器不支持使用安全密钥。请使用其他方法。","cookies_error":"你的浏览器似乎禁用了Cookie。如果不先启用它们，你可能无法登录。","omniauth_disallow_totp":"你的账户已启用双重验证，请使用密码登录。","sent_activation_email_again_generic":"我们发送了另一封激活邮件。它可能需要几分钟才能到达；记得检查你的垃圾邮件文件夹。","discord":{"title":"with Discord"},"second_factor_toggle":{"totp":"改用身份验证APP","backup_code":"使用备份码"}},"invites":{"success":"已创建你的账户，你现在可以登录了。"},"emoji_set":{"emoji_one":"JoyPixels （曾用名EmojiOne）"},"category_page_style":{"categories_boxes":"带子分类的框","categories_boxes_with_topics":"有特色主题的框"},"category_row":{"topic_count":"{{count}}个主题在此分类中"},"select_kit":{"max_content_reached":{"other":"你只能选择 {{count}} 条记录。"},"min_content_not_reached":{"other":"选择至少{{count}}条。"},"invalid_selection_length":"选择的字符至少为{{count}}个字符。"},"date_time_picker":{"errors":{"to_before_from":"截至日期必须晚于开始日期。"}},"emoji_picker":{"smileys_\u0026_emotion":"笑脸与情感","people_\u0026_body":"人与身体","animals_\u0026_nature":"动物与自然","food_\u0026_drink":"饮食","travel_\u0026_places":"旅行与地点","symbols":"符号","recent":"近期使用","default_tone":"无肤色","light_tone":"浅肤色","medium_light_tone":"中浅肤色","medium_tone":"中间肤色","medium_dark_tone":"中深肤色","dark_tone":"深肤色","default":"自定义表情符号"},"shared_drafts":{"title":"共享草稿","notice":"只有那些可以看到\u003cb\u003e{{category}}\u003c/b\u003e分类的人才能看到此主题。","destination_category":"目标分类","publish":"发布共享草稿","confirm_publish":"你确定要发布此草稿吗？"},"composer":{"toggle_unlisted":"显示/隐藏于主题列表","group_mentioned_limit":"\u003cb\u003e警告！\u003c/b\u003e你提到了\u003ca href='{{group_link}}'\u003e {{group}} \u003c/a\u003e，但该群组的成员数超过了的管理员配置的最大{{max}}人数。没人会收到通知。","group_mentioned":{"other":"提及 {{group}} 时，你将通知 \u003ca href='{{group_link}}'\u003e{{count}} 人\u003c/a\u003e － 确定吗？"},"cannot_see_mention":{"category":"你提到了 {{username}} ，然而他们不能访问该分类，所以他们不会被通知。你需要把他们加入到能访问该分类的群组中。","private":"你提到了{{userrname}}，然而他们不能访问该私信，所以他们不会被通知。你需要邀请他们至私信中。"},"duplicate_link":"好像\u003cb\u003e@{{username}}\u003c/b\u003e在\u003ca href='{{post_url}}'\u003e{{ago}}\u003c/a\u003e中前的回复中已经发了你的链接 \u003cb\u003e{{domain}}\u003c/b\u003e － 你想再次发表链接吗？","reference_topic_title":"回复：{{title}}","error":{"post_missing":"帖子不能为空","try_like":"试试{{heart}}按钮？","tags_missing":"你必须至少选择{{count}}个标签","topic_template_not_modified":"请通过编辑主题模板来为主题添加详情。"},"overwrite_edit":"覆盖编辑","create_whisper":"密语","create_shared_draft":"创建共享草稿","edit_shared_draft":"编辑共享草稿","topic_featured_link_placeholder":"在标题里输入链接","remove_featured_link":"从主题中移除链接。","reply_placeholder_no_images":"在此输入。 使用 Markdown，BBCode 或 HTML 格式。","reply_placeholder_choose_category":"输入前请选择一个分类。","saved_draft":"正在发布草稿。点击以继续。","link_url_placeholder":"粘贴 URL 或键入以搜索主题","toggle_direction":"切换方向","collapse":"最小化编辑面板","open":"打开编辑面板","abandon":"关闭编辑面板并放弃草稿","enter_fullscreen":"进入全屏编辑模式","exit_fullscreen":"退出全屏编辑模式","yourself_confirm":{"body":"目前该私信只发给了你自己！"},"composer_actions":{"draft":"草稿","reply_to_post":{"label":"通过%{postUsername}回复帖子%{postNumber}","desc":"回复特定帖子"},"reply_as_new_topic":{"label":"回复为联结主题","desc":"创建一个新主题链接到这一主题","confirm":"您保存了新的主题草稿，如果您创建链接主题该草稿将被覆盖。"},"reply_as_private_message":{"label":"新消息","desc":"新建一个私信"},"reply_to_topic":{"label":"回复主题","desc":"回复主题，不是任何特定的帖子"},"toggle_whisper":{"label":"切换密语","desc":"只有管理人员才能看到密语"},"shared_draft":{"label":"共享草稿","desc":"起草一个只对管理人员可见的主题"},"toggle_topic_bump":{"label":"切换主题置顶","desc":"回复而不更改最新回复日期"}},"details_text":"此本文本将被隐藏"},"notifications":{"tooltip":{"regular":{"other":"{{count}} 个未读通知"},"message":{"other":"{{count}} 条未读私信"},"high_priority":{"other":"%{count}个未读的高优先级通知"}},"reviewable_items":"待审核帖子","mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","group_mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","quoted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","bookmark_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e{{description}}","replied":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","posted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","edited":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked_2":"\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}","liked_many":{"other":"\u003cspan\u003e{{username}}, {{username2}} 和其他 {{count}} 人\u003c/span\u003e {{description}}"},"liked_consolidated":"\u003cspan\u003e{{username}}\u003c/span\u003e{{description}}","private_message":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_topic":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","linked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","granted_badge":"获得 “{{description}}”","topic_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","watching_first_post":"\u003cspan\u003e新主题\u003c/span\u003e {{description}}","membership_request_accepted":"接受来自“{{group_name}}”的邀请","membership_request_consolidated":"{{count}}个加入“{{group_name}}”群组的请求","group_message_summary":{"other":"{{count}} 条私信在{{group_name}}组的收件箱中"},"popup":{"private_message":"{{username}}在“{{topic}}”中向你发送了个人消息 - {{site_title}}","watching_first_post":"{{username}}发布了新主题“{{topic}}” - {{site_title}}","confirm_title":"通知已启用 - %{site_title}","confirm_body":"成功！通知已启用。","custom":"来自{{username}}在%{site_title}的通知"},"titles":{"mentioned":"提及到","replied":"新回复","quoted":"引用","edited":"编辑","private_message":"新私信","invited_to_private_message":"邀请进行私下交流","invitee_accepted":"邀请已接受","posted":"新帖子","moved_post":"帖子已移动","linked":"链接","bookmark_reminder":"收藏提醒","bookmark_reminder_with_name":"收藏提醒 - %{name}","granted_badge":"勋章授予","invited_to_topic":"邀请到主题","group_mentioned":"群组提及","group_message_summary":"新建群组消息","topic_reminder":"主题提醒","liked_consolidated":"新的赞","post_approved":"帖子已审批","membership_request_consolidated":"新的成员申请"}},"search":{"full_page_title":"搜索主题或帖子","more_results":"还有更多结果。请增加你的搜索条件。","cant_find":"找不到你要找的内容？","start_new_topic":"不如创建一个新主题？","or_search_google":"或者尝试使用Google进行搜索：","search_google":"尝试使用Google进行搜索：","context":{"category":"搜索 #{{category}} 分类","tag":"搜索＃{{tag}}标签"},"advanced":{"in_category":{"label":"分类"},"with_tags":{"label":"标签"},"filters":{"label":"只返回主题/帖子……","created":"我创建的","watching":"我正在监看","tracking":"我正在追踪","private":"在我的私信中","bookmarks":"我收藏了","first":"是第一帖","seen":"我看了","images":"包含图片","all_tags":"上述所有标签"},"statuses":{"label":"当主题","public":"是公开的"}}},"view_all":"查看全部","topics":{"bulk":{"relist_topics":"把主题重新置于主题列表中","change_category":"设置分类","change_tags":"替换标签","append_tags":"添加标签","choose_append_tags":"为这些主题添加新标签：","changed_tags":"主题的标签被修改"}},"topic":{"filter_to":{"other":"本主题中的 {{count}} 帖"},"open_draft":"打开草稿","edit_message":{"help":"编辑消息中的第一帖","title":"编辑消息"},"defer":{"help":"标记为未读"},"feature_on_profile":{"help":"添加此主题的链接到你的用户卡片和资料中。","title":"精选到个人资料"},"remove_from_profile":{"warning":"你的个人资料中已存在精选主题。如果继续，此主题会替换存在的主题。","help":"在你的个人资料中移除指向该主题的链接","title":"从个人资料中移除"},"group_request":"你需要请求加入`{{name}}`群组才能查看此主题。","group_join":"你需要加入`{{name}}`群组以查看此主题","group_request_sent":"你加入群组的请求已发送。当被接受时你会收到通知。","unread_indicator":"还没有成员读过此主题的最新帖子。","topic_status_update":{"title":"主题计时器","save":"设置计时器","num_of_days":"天数","publish_to":"发布至：","public_timer_types":"主题计时器","private_timer_types":"用户主题计时器","time_frame_required":"请选择一个时间范围"},"auto_update_input":{"none":"选择时间范围","later_today":"今天的某个时候","later_this_week":"这周的某个时候","two_weeks":"两周","two_months":"两个月","three_months":"三个月","four_months":"四个月","six_months":"六个月","one_year":"一年","forever":"永远","set_based_on_last_post":"按照最新帖子关闭"},"publish_to_category":{"title":"计划发布"},"temp_open":{"title":"临时开启"},"auto_reopen":{"title":"自动开启主题"},"auto_close":{"title":"自动关闭主题","label":"自动关闭于几小时后："},"auto_delete":{"title":"自动删除主题"},"auto_bump":{"title":"自动顶帖"},"auto_delete_replies":{"title":"自动删除回复"},"status_update_notice":{"auto_publish_to_category":"主题%{timeLeft}将发布到\u003ca href=%{categoryUrl}\u003e#%{categoryName}\u003c/a\u003e 。","auto_delete":"主题在%{timeLeft}后将被自动删除。","auto_bump":"此主题将在%{timeLeft}后自动顶起。","auto_reminder":"你将在%{timeLeft}后收到该主题的提醒。","auto_delete_replies":"此主题的回复会在%{duration}后自动删除。"},"auto_close_immediate":{"other":"主题中的最后一帖是 %{hours} 小时前发出的，所以主题将会立即关闭。"},"timeline":{"back_description":"回到最后一个未读帖子"},"progress":{"jump_prompt_long":"跳到……","jump_prompt_to_date":"至今"},"notifications":{"title":"改变你收到该主题通知的频率","reasons":{"mailing_list_mode":"邮件列表模式已启用，将以邮件通知你关于该主题的回复。","3_10":"因为你正监看该主题上的标签，你将会收到通知。","2_4":"你会看到新回复的数量的原因是你曾经回复过该主题。","2_2":"你会看到新回复数量的原因是你正在追踪该主题。"}},"actions":{"timed_update":"设置主题计时器…","make_private":"设置为私信","reset_bump_date":"重置顶帖日期"},"share":{"extended_title":"分享一个链接"},"print":{"help":"打开该主题对打印友好的版本"},"make_public":{"title":"转换到公开主题","choose_category":"请选择公共主题分类："},"automatically_add_to_groups":"邀请将把用户加入群组：","invite_private":{"success_group":"成功邀请了群组至该私信。"},"invite_reply":{"success_existing_email":"用户\u003cb\u003e{{emailOrUsername}}\u003c/b\u003e已存在。我们已经邀请了该用户参与该主题。"},"move_to":{"title":"移动到","action":"移动到","error":"移动帖子时发生了错误。"},"split_topic":{"topic_name":"新主题的标题"},"merge_topic":{"radio_label":"现存的主题"},"move_to_new_message":{"title":"移动到新的即时信息","action":"移动到新的私信","message_title":"新私信的标题","participants":"参与者","instructions":{"other":"你正在发送\u003cb\u003e{{count}}\u003c/b\u003e篇帖子到一条新的私信/消息。"}},"move_to_existing_message":{"title":"移动到现存的私信","action":"移动到已存在的私信","radio_label":"现存的私信","participants":"参与者","instructions":{"other":"请选择你要将\u003cb\u003e{{count}}\u003c/b\u003e个帖子所移动到的私信。"}},"merge_posts":{"title":"合并选择的帖子","action":"合并选择的帖子","error":"合并帖子时发生了错误。"},"publish_page":{"publish":"出版","description":"当一个主题被出版为一个页面时，其链接是共享的，并且会以自定义的样式显示。","slug":"Slug","publish_url":"你的页面已出版于：","topic_published":"你的主题已出版于：","preview_url":"你的页面将出版于：","invalid_slug":"抱歉，您不能出版此页面。","unpublish":"取消出版","unpublished":"你的页面已经取消出版并且不再可用。","publishing_settings":"出版设置"},"change_owner":{"title":"更改所有者","instructions":{"other":"请选择\u003cb\u003e@{{old_user}}\u003c/b\u003e创建的{{count}}个帖子的新作者。"},"instructions_without_old_user":{"other":"请为此{{count}}个帖子选择一个新的拥有者。"}},"change_timestamp":{"title":"修改时间"},"multi_select":{"select_post":{"title":"将帖子加入选择"},"selected_post":{"label":"已选中","title":"单击以将帖子从中移除"},"select_replies":{"title":"选择帖子及其所有回复"},"select_below":{"label":"选择 +以下","title":"选择帖子及其后的所有内容"}},"deleted_by_author":{"other":"（主题被作者撤回，除非被标记，不然将在%{count}小时后自动删除）"}},"post":{"ignored":"忽视的内容","wiki_last_edited_on":"维基最后修改于","reply_as_new_private_message":"向相同的收件人回复新私信","show_hidden":"显示已忽略内容。","collapse":"折叠","locked":"一管理人员锁定了该帖的编辑","notice":{"new_user":"这是 {{user}} 发的第一个帖子 - 让我们欢迎他加入社区！","returning_user":"从我们上一次看到 {{user}} 有一阵子了 — 他上次发帖是 {{time}}."},"errors":{"file_too_large":"抱歉，该文件太大（最大大小为 {{max_size_kb}}KB）。为什么不将您的大文件上传到云共享服务，然后粘贴链接？","too_many_dragged_and_dropped_files":"抱歉，你一次只能上传最多{{max}}个文件。","upload_not_authorized":"抱歉，你没有上传文件的权限（验证扩展：{{authorized_extensions}}）。"},"abandon_edit":{"confirm":"您确定要放弃所做的更改吗？","no_save_draft":"不，保存草稿","yes_value":"是的，忽略编辑"},"abandon":{"no_save_draft":"不，保存草稿"},"via_auto_generated_email":"通过自动生成邮件发表的帖子","controls":{"read_indicator":"阅读了帖子的用户","delete_replies":{"confirm":"你也想删除该贴的回复？","direct_replies":{"other":"是，{{count}}个直接回复"},"all_replies":{"other":"是，所有{{count}}个回复"}},"lock_post":"锁定帖子","lock_post_description":"禁止发帖者编辑这篇帖子","unlock_post":"解锁帖子","unlock_post_description":"允许发布者编辑帖子","delete_topic_disallowed_modal":"你无权删除该贴。如果你真想删除，向版主提交原因并标记。","delete_topic_disallowed":"你无权删除此主题","add_post_notice":"添加管理人员通知","remove_post_notice":"移除管理人员通知","remove_timer":"移除计时器"},"actions":{"defer_flags":{"other":"忽略标记"},"people":{"read":{"other":"看过"},"read_capped":{"other":"还有{{count}}个其他用户看过"}}},"delete":{"confirm":{"other":"你确定要删除{{count}}个帖子吗？"}},"merge":{"confirm":{"other":"确定要合并这 {{count}} 个帖子吗？"}},"revisions":{"controls":{"comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e {{icon}} \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"}},"raw_email":{"displays":{"raw":{"title":"显示原始邮件地址"},"text_part":{"title":"显示邮件的文字部分"},"html_part":{"title":"显示邮件的 HTML 部分"}}},"bookmarks":{"create":"创建收藏夹","edit":"编辑收藏","name_placeholder":"这个收藏是做什么用的？","set_reminder":"提醒我","actions":{"delete_bookmark":{"name":"删除收藏","description":"从你的个人资料中删除收藏并停止所有有关该收藏的提醒"},"edit_bookmark":{"name":"编辑收藏","description":"编辑收藏名称或修改提醒的日期和时间"}}}},"category":{"choose":"分类\u0026hellip;","edit_dialog_title":"编辑: %{categoryName}","tags_allowed_tags":"限制这些标签只能用在此分类","tags_allowed_tag_groups":"限制这些标签组只能用在此分类","tags_tab_description":"上面所指定的标签和标签组仅在此分类以及其它也指定了它们的分类中可用。它们将无法在其它分类中使用。","tag_groups_placeholder":"（可选）允许使用的标签组列表","manage_tag_groups_link":"管理这里的标签组。","allow_global_tags_label":"也允许其它标签","tag_group_selector_placeholder":"（可选）标签组","required_tag_group_description":"要求新主题包含标签组中的标签：","min_tags_from_required_group_label":"标签数量：","required_tag_group_label":"标签组：","topic_featured_link_allowed":"允许在该分类中发布特色链接标题","uncategorized_security_warning":"这是个特殊的分类。如果不知道应该话题属于哪个分类，那么请使用这个分类。这个分类没有安全设置。","uncategorized_general_warning":"这个分类是特殊的。它用作未选择分类的新主题的默认分类。如果你想要避免此行为并强制选择分类，\u003ca href=\"%{settingLink}\"\u003e请在此处禁用该设置\u003c/a\u003e。如果你要修改其名称或描述，请转到\u003ca href=\"%{customizeLink}\"\u003e自定义/文本内容\u003c/a\u003e。","pending_permission_change_alert":"你还没有添加%{group}到此分类；点击此按钮添加。","mailinglist_mirror":"分类镜像了一个邮件列表","show_subcategory_list":"在这个分类中把子分类列表显示在主题的上面","num_featured_topics":"分类页面上显示的主题数量：","subcategory_num_featured_topics":"父分类页面上的推荐主题数量：","all_topics_wiki":"默认将新主题设为维基主题","subcategory_list_style":"子分类列表样式：","sort_order":"主题排序依据：","default_view":"默认主题列表：","default_top_period":"默认热门时长：","reviewable_by_group":"管理人员之外，可以审核该分类中的帖子和标记的人：","require_topic_approval":"所有新主题需要版主审批","require_reply_approval":"所有新回复需要版主审批","position":"分类页面位置：","minimum_required_tags":"在一个主题中至少含有多少个标签：","num_auto_bump_daily":"每天自动碰撞的主题的数量","navigate_to_first_post_after_read":"阅读主题后导航到第一个帖子","notifications":{"watching":{"description":"你将自动关注这些分类中的所有主题。你会收到所有新主题中的每一个新帖的通知，还会显示新回复的数量。"},"watching_first_post":{"description":"你将收到此分类中的新主题通知，不包括回复。"},"tracking":{"description":"你将自动跟踪这些分类中的所有主题。如果有人@你或回复你，将通知你，还将显示新回复的数量。"}},"search_priority":{"label":"搜索优先级","options":{"very_low":"非常低","low":"低","very_high":"非常高"}},"sort_options":{"op_likes":"原始帖子赞"},"subcategory_list_styles":{"rows":"行","rows_with_featured_topics":"有推荐主题的行","boxes":"盒子","boxes_with_featured_topics":"有推荐主题的盒子"},"settings_sections":{"moderation":"审核","appearance":"主题"}},"flagging":{"custom_message":{"more":{"other":"还差 {{count}} 个…"}}},"post_links":{"about":"为本帖展开更多链接"},"topic_statuses":{"personal_message":{"title":"此主题是一条私信","help":"此主题是一条私信"}},"raw_email":{"title":"进站邮件"},"browser_update":"抱歉，\u003ca href=\"http://www.discourse.com/faq/#browser\"\u003e你的浏览器版本太低，无法正常访问该站点\u003c/a\u003e。请\u003ca href=\"http://browsehappy.com\"\u003e升级你的浏览器\u003c/a\u003e。","lightbox":{"previous":"上一个（左方向键）","next":"下一个（右方向键）","counter":"%curr% / %total%","close":"关闭(Esc)","content_load_error":"\u003ca href=\"%url%\"\u003e内容\u003c/a\u003e无法加载","image_load_error":"\u003ca href=\"%url%\"\u003e图像\u003c/a\u003e无法加载"},"keyboard_shortcuts_help":{"shortcut_key_delimiter_comma":"，","shortcut_key_delimiter_plus":"+","shortcut_delimiter_or":"%{shortcut1}或%{shortcut2}","shortcut_delimiter_slash":"%{shortcut1}/%{shortcut2}","shortcut_delimiter_space":"%{shortcut1}%{shortcut2}","jump_to":{"drafts":"%{shortcut}草稿"},"navigation":{"go_to_unread_post":"%{shortcut}前往第一个未读帖子"},"application":{"search":"%{shortcut} 搜索"},"composing":{"title":"编辑","return":"%{shortcut}返回编辑器","fullscreen":"%{shortcut}全屏编辑器"},"bookmarks":{"title":"收藏","enter":"%{shortcut} 保存并关闭","later_today":"%{shortcut} 今天晚些时候","later_this_week":"%{shortcut} 本周的晚些时候","tomorrow":"%{shortcut} 明天","next_week":"%{shortcut} 下周","next_month":"%{shortcut} 下个月","next_business_week":"%{shortcut} 下周开始","next_business_day":"%{shortcut} 下个工作日","custom":"%{shortcut} 自定义日期和时间","none":"%{shortcut} 没有提醒","delete":"%{shortcut} 删除收藏"},"actions":{"print":"%{shortcut} 打印主题","defer":"%{shortcut}延迟主题","topic_admin_actions":"%{shortcut}打开主题管理"},"search_menu":{"title":"搜索菜单","prev_next":"%{shortcut}上下移动所选内容","insert_url":"%{shortcut}将选定内容插入到打开的编辑器"}},"badges":{"allow_title":"你可以将该徽章设为头衔","multiple_grant":"可多次获得","more_badges":{"other":"+%{count} 更多"},"granted":{"other":"%{count} 已授予"},"successfully_granted":"成功将 %{badge} 授予 %{username}"},"tagging":{"other_tags":"其他标签","choose_for_topic":"可选标签","info":"详情","default_info":"该标签不限于任何类别，并且没有同义词。","category_restricted":"此标签仅限于你无权访问的分类。","synonyms":"同义词","synonyms_description":"使用以下标签时，它们将被替换为\u003cb\u003e%{base_tag_name}\u003c/b\u003e 。","tag_groups_info":{"other":"此标签属于这些标签组：{{tag_groups}}。"},"category_restrictions":{"other":"只能在这些分类中使用："},"edit_synonyms":"管理同义词","add_synonyms_label":"添加同义词：","add_synonyms_explanation":{"other":"当前任何使用了此标签的地方都将被改为使用\u003cb\u003e%{tag_name}\u003c/b\u003e代替。你确定要应用此更改吗？"},"add_synonyms_failed":"不能将以下标记添加为同义词： \u003cb\u003e%{tag_names}\u003c/b\u003e 。确保它们没有同义词并且不是其他标签的同义词。","remove_synonym":"删除同义词","delete_synonym_confirm":"您确定要删除同义词“ %{tag_name}”吗？","delete_confirm":{"other":"你确定你想要删除这个标签以及撤销在{{count}}个主题中的关联么？"},"delete_confirm_no_topics":"你确定你想要删除这个标签吗？","delete_confirm_synonyms":{"other":"其{{count}}个同义词也将被删除。"},"manage_groups":"管理标签组","manage_groups_description":"管理标签的群组","upload":"上传标签","upload_description":"上传csv文件以批量创建标签","upload_instructions":"每行一个，可选带有'tag_name，tag_group'格式的标签组。","upload_successful":"标签上传成功","delete_unused_confirmation":{"other":"%{count}标签将被删除：%{tags}"},"delete_unused_confirmation_more_tags":{"other":"%{tags}和%{count}更多"},"delete_unused":"删除未使用的标签","delete_unused_description":"删除所有未与主题或私信关联的标签","filters":{"without_category":"%{tag}的%{filter}主题","with_category":"%{filter} %{tag}主题在%{category}"},"notifications":{"watching":{"description":"你将自动监看所有含有此标签的主题。你将收到所有新帖子和主题的通知，此外，主题旁边还会显示未读和新帖子的数量。"},"watching_first_post":{"description":"你将会收到此标签中的新主题的通知，但对主题的回复则不会。"},"tracking":{"description":"你将自动监看所有含有此标签的主题。未读和新帖的计数将显示在主题旁边。"},"regular":{"description":"有人@你或回复你的帖子时将会通知你"},"muted":{"description":"你不会收到任何含有此标签的新主题的通知，也不会在未读栏。"}},"groups":{"title":"标签组","about":"将标签分组以便管理。","tags_placeholder":"标签","parent_tag_description":"未设置上级标签前群组内标签无法使用。","one_per_topic_label":"只可给主题设置一个该组内的标签","new_name":"新建标签组","name_placeholder":"标签组名称","confirm_delete":"确定要删除此标签组吗？","everyone_can_use":"每个人都可以使用标签","usable_only_by_staff":"标签对所有人可见，但只有管理人员可以使用它们","visible_only_to_staff":"标签仅对管理人员可见"}},"invite":{"custom_message":"通过编写\u003ca href\u003e自定义消息\u003c/a\u003e，使你的邀请更个性化。","custom_message_placeholder":"输入留言","custom_message_template_forum":"你好，你应该加入这个论坛！","custom_message_template_topic":"你好，我觉得你可能会喜欢这个主题！"},"forced_anonymous":"由于极端负载，暂时向所有人显示，已注销用户会看到它。","safe_mode":{"enabled":"安全模式已经开启，关闭该浏览器窗口以退出安全模式"},"poll":{"results":{"groups":{"title":"你需要成为 %{groups} 的一员才能投票。"},"vote":{"title":"结果将显示在\u003cstrong\u003e投票\u003c/strong\u003e上。"},"closed":{"title":"结果将显示一次\u003cstrong\u003e关闭\u003c/strong\u003e。"},"staff":{"title":"结果仅显示给\u003cstrong\u003e管理\u003c/strong\u003e成员。"}},"hide-results":{"label":"显示投票"},"group-results":{"title":"按用户字段分组投票","label":"显示错误"},"ungroup-results":{"title":"合并所有投票","label":"隐藏错误"},"export-results":{"title":"到处投票结果"},"automatic_close":{"closes_in":"于\u003cstrong\u003e%{timeLeft}\u003c/strong\u003e关闭。","age":"\u003cstrong\u003e%{age}\u003c/strong\u003e关闭"},"error_while_exporting_results":"抱歉，导出投票结果时出错。","ui_builder":{"help":{"options_count":"至少输入1个选项"},"poll_result":{"always":"总是可见","vote":"投票","closed":"关闭时","staff":"仅管理人员"},"poll_groups":{"label":"允许的群组"},"poll_chart_type":{"label":"图表类型"},"automatic_close":{"label":"自动关闭投票"}}},"discourse_local_dates":{"relative_dates":{"today":"今天%{time}","tomorrow":"明天%{time}","yesterday":"昨天%{time}","countdown":{"passed":"日期已过"}},"title":"插入日期/时间","create":{"form":{"insert":"插入","advanced_mode":"高级模式","simple_mode":"简单模式","format_description":"向用户显示日期的格式。 使用“\\T\\Z”以单词显示用户时区（欧洲/巴黎）","timezones_title":"要显示的时区","timezones_description":"时区将用于在预览和撤回中显示日期。","recurring_title":"循环","recurring_description":"定义重复事件。你还可以手动编辑表单生成的周期性选项，并使用以下键之一：年，季，月，周，日，小时，分钟，秒，毫秒。","recurring_none":"没有循环","invalid_date":"日期无效，请确保日期和时间正确","format_title":"日期格式","until":"直到......","recurring":{"every_day":"每天","every_week":"每周","every_two_weeks":"每两周","every_month":"每月","every_two_months":"每两个月","every_three_months":"每三个月","every_six_months":"每六个月","every_year":"每年"}}}},"presence":{"replying_to_topic":{"other":"正在回复"}}}},"en":{"js":{"number":{"human":{"storage_units":{"units":{"byte":{"one":"Byte"}}}}},"dates":{"tiny":{"less_than_x_seconds":{"one":"\u003c %{count}s"},"x_seconds":{"one":"%{count}s"},"less_than_x_minutes":{"one":"\u003c %{count}m"},"x_minutes":{"one":"%{count}m"},"about_x_hours":{"one":"%{count}h"},"x_days":{"one":"%{count}d"},"x_months":{"one":"%{count}mon"},"about_x_years":{"one":"%{count}y"},"over_x_years":{"one":"\u003e %{count}y"},"almost_x_years":{"one":"%{count}y"}},"medium":{"x_minutes":{"one":"%{count} min"},"x_hours":{"one":"%{count} hour"},"x_days":{"one":"%{count} day"}},"medium_with_ago":{"x_minutes":{"one":"%{count} min ago"},"x_hours":{"one":"%{count} hour ago"},"x_days":{"one":"%{count} day ago"},"x_months":{"one":"%{count} month ago"},"x_years":{"one":"%{count} year ago"}},"later":{"x_days":{"one":"%{count} day later"},"x_months":{"one":"%{count} month later"},"x_years":{"one":"%{count} year later"}}},"links_lowercase":{"one":"link"},"character_count":{"one":"{{count}} character"},"topic_count_latest":{"one":"See {{count}} new or updated topic"},"topic_count_unread":{"one":"See {{count}} unread topic"},"topic_count_new":{"one":"See {{count}} new topic"},"review":{"topic_has_pending":{"one":"This topic has \u003cb\u003e%{count}\u003c/b\u003e post pending approval"},"user_percentage":{"summary":{"one":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} total flag)"},"agreed":{"one":"{{count}}% agree"},"disagreed":{"one":"{{count}}% disagree"},"ignored":{"one":"{{count}}% ignore"}},"topics":{"unique_users":{"one":"%{count} user"}},"replies":{"one":"%{count} reply"},"approval":{"pending_posts":{"one":"You have \u003cstrong\u003e%{count}\u003c/strong\u003e post pending."}}},"directory":{"total_rows":{"one":"%{count} user"}},"groups":{"title":{"one":"Group"}},"categories":{"topic_sentence":{"one":"%{count} topic"},"topic_stat_sentence_week":{"one":"%{count} new topic in the past week."},"topic_stat_sentence_month":{"one":"%{count} new topic in the past month."}},"user":{"change_password":{"emoji":"lock emoji"},"email":{"frequency":{"one":"We'll only email you if we haven't seen you in the last minute."}},"invited":{"truncated":{"one":"Showing the first invite."}},"summary":{"topic_count":{"one":"topic created"},"post_count":{"one":"post created"},"likes_given":{"one":"given"},"likes_received":{"one":"received"},"days_visited":{"one":"day visited"},"topics_entered":{"one":"topic viewed"},"posts_read":{"one":"post read"},"bookmark_count":{"one":"bookmark"}}},"local_time":"Local Time","replies_lowercase":{"one":"reply"},"email_login":{"emoji":"lock emoji"},"invites":{"emoji":"envelope emoji"},"select_kit":{"max_content_reached":{"one":"You can only select {{count}} item."},"min_content_not_reached":{"one":"Select at least {{count}} item."}},"composer":{"group_mentioned":{"one":"By mentioning {{group}}, you are about to notify \u003ca href='{{group_link}}'\u003e%{count} person\u003c/a\u003e – are you sure?"}},"notifications":{"tooltip":{"regular":{"one":"%{count} unseen notification"},"message":{"one":"%{count} unread message"},"high_priority":{"one":"%{count} unread high priority notification"}},"liked_many":{"one":"\u003cspan\u003e{{username}}, {{username2}} and %{count} other\u003c/span\u003e {{description}}"},"liked_consolidated_description":{"one":"liked {{count}} of your posts"},"group_message_summary":{"one":"{{count}} message in your {{group_name}} inbox"}},"search":{"result_count":{"one":"\u003cspan\u003e%{count} result for\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e"}},"topics":{"bulk":{"selected":{"one":"You have selected \u003cb\u003e%{count}\u003c/b\u003e topic."}}},"topic":{"filter_to":{"one":"%{count} post in topic"},"new_topics":{"one":"%{count} new topic"},"unread_topics":{"one":"%{count} unread topic"},"total_unread_posts":{"one":"you have %{count} unread post in this topic"},"unread_posts":{"one":"you have %{count} unread old post in this topic"},"new_posts":{"one":"there is %{count} new post in this topic since you last read it"},"likes":{"one":"there is %{count} like in this topic"},"auto_close_immediate":{"one":"The last post in the topic is already %{count} hour old, so the topic will be closed immediately."},"feature_topic":{"already_pinned":{"one":"Topics currently pinned in {{categoryLink}}: \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e"},"already_pinned_globally":{"one":"Topics currently pinned globally: \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e"}},"filters":{"n_posts":{"one":"%{count} post"}},"split_topic":{"instructions":{"one":"You are about to create a new topic and populate it with the post you've selected."}},"merge_topic":{"instructions":{"one":"Please choose the topic you'd like to move that post to."}},"move_to_new_message":{"instructions":{"one":"You are about to create a new message and populate it with the post you've selected."}},"move_to_existing_message":{"instructions":{"one":"Please choose the message you'd like to move that post to."}},"publish_page":{"title":"Page Publishing"},"change_owner":{"instructions":{"one":"Please choose a new owner for the post by \u003cb\u003e@{{old_user}}\u003c/b\u003e"},"instructions_without_old_user":{"one":"Please choose a new owner for the post"}},"multi_select":{"description":{"one":"You have selected \u003cb\u003e%{count}\u003c/b\u003e post."}},"deleted_by_author":{"one":"(topic withdrawn by author, will be automatically deleted in %{count} hour unless flagged)"}},"post":{"deleted_by_author":{"one":"(post withdrawn by author, will be automatically deleted in %{count} hour unless flagged)"},"gap":{"one":"view %{count} hidden reply"},"has_replies":{"one":"{{count}} Reply"},"has_likes_title":{"one":"%{count} person liked this post"},"has_likes_title_you":{"one":"you and %{count} other person liked this post"},"controls":{"delete_replies":{"direct_replies":{"one":"Yes, and %{count} direct reply"},"all_replies":{"one":"Yes, and %{count} reply"}},"publish_page":"Page Publishing"},"actions":{"defer_flags":{"one":"Ignore flag"},"people":{"like":{"one":"liked this"},"read":{"one":"read this"},"like_capped":{"one":"and {{count}} other liked this"},"read_capped":{"one":"and {{count}} other read this"}}},"delete":{"confirm":{"one":"Are you sure you want to delete that post?"}},"merge":{"confirm":{"one":"Are you sure you want to merge those posts?"}}},"flagging":{"custom_message":{"at_least":{"one":"enter at least %{count} character"},"more":{"one":"%{count} to go..."},"left":{"one":"%{count} remaining"}}},"topic_map":{"clicks":{"one":"%{count} click"}},"post_links":{"title":{"one":"%{count} more"}},"views_lowercase":{"one":"view"},"views_long":{"one":"this topic has been viewed %{count} time"},"likes_lowercase":{"one":"like"},"users_lowercase":{"one":"user"},"filters":{"latest":{"title_with_count":{"one":"Latest (%{count})"}},"unread":{"title_with_count":{"one":"Unread (%{count})"},"lower_title_with_count":{"one":"%{count} unread"}},"new":{"lower_title_with_count":{"one":"%{count} new"},"title_with_count":{"one":"New (%{count})"}},"category":{"title_with_count":{"one":"{{categoryName}} (%{count})"}}},"badges":{"earned_n_times":{"one":"Earned this badge %{count} time"},"badge_count":{"one":"%{count} Badge"},"more_badges":{"one":"+%{count} More"},"granted":{"one":"%{count} granted"}},"tagging":{"tag_groups_info":{"one":"This tag belongs to the group \"{{tag_groups}}\"."},"category_restrictions":{"one":"It can only be used in this category:"},"add_synonyms_explanation":{"one":"Any place that currently uses this tag will be changed to use \u003cb\u003e%{tag_name}\u003c/b\u003e instead. Are you sure you want to make this change?"},"delete_confirm":{"one":"Are you sure you want to delete this tag and remove it from %{count} topic it is assigned to?"},"delete_confirm_synonyms":{"one":"Its synonym will also be deleted."},"delete_unused_confirmation":{"one":"%{count} tag will be deleted: %{tags}"},"delete_unused_confirmation_more_tags":{"one":"%{tags} and %{count} more"}},"discourse_internet_explorer":{"deprecation_warning":"This site will soon remove support for Internet Explorer 11 - please update your browser"},"poll":{"voters":{"one":"voter"},"total_votes":{"one":"total vote"},"multiple":{"help":{"at_least_min_options":{"one":"Choose at least \u003cstrong\u003e%{count}\u003c/strong\u003e option"},"up_to_max_options":{"one":"Choose up to \u003cstrong\u003e%{count}\u003c/strong\u003e option"},"x_options":{"one":"Choose \u003cstrong\u003e%{count}\u003c/strong\u003e option"}}},"ui_builder":{"poll_chart_type":{"bar":"Bar","pie":"Pie"}}},"presence":{"replying_to_topic":{"one":"replying"}},"voting":{"votes_left":{"one":"You have {{count}} vote left, see \u003ca href='{{path}}'\u003eyour votes\u003c/a\u003e."},"votes":{"one":"{{count}} vote"},"anonymous_button":{"one":"Vote"}},"admin":{"logs":{"staff_actions":{"actions":{"discourse_upgrade":"Upgrade to the Latest Version"}}}},"docker":{"link_to_upgrade":"Perform upgrades here."}}}};
I18n.locale = 'vi';
I18n.pluralizationRules.vi = MessageFormat.locale.vi;
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


    var vi = moment.defineLocale('vi', {
        months : 'tháng 1_tháng 2_tháng 3_tháng 4_tháng 5_tháng 6_tháng 7_tháng 8_tháng 9_tháng 10_tháng 11_tháng 12'.split('_'),
        monthsShort : 'Th01_Th02_Th03_Th04_Th05_Th06_Th07_Th08_Th09_Th10_Th11_Th12'.split('_'),
        monthsParseExact : true,
        weekdays : 'chủ nhật_thứ hai_thứ ba_thứ tư_thứ năm_thứ sáu_thứ bảy'.split('_'),
        weekdaysShort : 'CN_T2_T3_T4_T5_T6_T7'.split('_'),
        weekdaysMin : 'CN_T2_T3_T4_T5_T6_T7'.split('_'),
        weekdaysParseExact : true,
        meridiemParse: /sa|ch/i,
        isPM : function (input) {
            return /^ch$/i.test(input);
        },
        meridiem : function (hours, minutes, isLower) {
            if (hours < 12) {
                return isLower ? 'sa' : 'SA';
            } else {
                return isLower ? 'ch' : 'CH';
            }
        },
        longDateFormat : {
            LT : 'HH:mm',
            LTS : 'HH:mm:ss',
            L : 'DD/MM/YYYY',
            LL : 'D MMMM [năm] YYYY',
            LLL : 'D MMMM [năm] YYYY HH:mm',
            LLLL : 'dddd, D MMMM [năm] YYYY HH:mm',
            l : 'DD/M/YYYY',
            ll : 'D MMM YYYY',
            lll : 'D MMM YYYY HH:mm',
            llll : 'ddd, D MMM YYYY HH:mm'
        },
        calendar : {
            sameDay: '[Hôm nay lúc] LT',
            nextDay: '[Ngày mai lúc] LT',
            nextWeek: 'dddd [tuần tới lúc] LT',
            lastDay: '[Hôm qua lúc] LT',
            lastWeek: 'dddd [tuần rồi lúc] LT',
            sameElse: 'L'
        },
        relativeTime : {
            future : '%s tới',
            past : '%s trước',
            s : 'vài giây',
            ss : '%d giây' ,
            m : 'một phút',
            mm : '%d phút',
            h : 'một giờ',
            hh : '%d giờ',
            d : 'một ngày',
            dd : '%d ngày',
            M : 'một tháng',
            MM : '%d tháng',
            y : 'một năm',
            yy : '%d năm'
        },
        dayOfMonthOrdinalParse: /\d{1,2}/,
        ordinal : function (number) {
            return number;
        },
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 4  // The week that contains Jan 4th is the first week of the year.
        }
    });

    return vi;

})));

// moment-timezone-localization for lang code: vi

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['../moment'], factory) :
   factory(global.moment)
}(this, (function (moment) { 'use strict';


moment.tz.localizedNames = function() {
  return [{"value":"Africa/Abidjan","name":"Abidjan","id":"Africa/Abidjan"},{"value":"Africa/Accra","name":"Accra","id":"Africa/Accra"},{"value":"Africa/Addis_Ababa","name":"Addis Ababa","id":"Africa/Addis_Ababa"},{"value":"Africa/Algiers","name":"Algiers","id":"Africa/Algiers"},{"value":"Africa/Asmera","name":"Asmara","id":"Africa/Asmera"},{"value":"Africa/Bamako","name":"Bamako","id":"Africa/Bamako"},{"value":"Africa/Bangui","name":"Bangui","id":"Africa/Bangui"},{"value":"Africa/Banjul","name":"Banjul","id":"Africa/Banjul"},{"value":"Africa/Bissau","name":"Bissau","id":"Africa/Bissau"},{"value":"Africa/Blantyre","name":"Blantyre","id":"Africa/Blantyre"},{"value":"Africa/Brazzaville","name":"Brazzaville","id":"Africa/Brazzaville"},{"value":"Africa/Bujumbura","name":"Bujumbura","id":"Africa/Bujumbura"},{"value":"Africa/Cairo","name":"Cairo","id":"Africa/Cairo"},{"value":"Africa/Casablanca","name":"Casablanca","id":"Africa/Casablanca"},{"value":"Africa/Ceuta","name":"Ceuta","id":"Africa/Ceuta"},{"value":"Africa/Conakry","name":"Conakry","id":"Africa/Conakry"},{"value":"Africa/Dakar","name":"Dakar","id":"Africa/Dakar"},{"value":"Africa/Dar_es_Salaam","name":"Dar es Salaam","id":"Africa/Dar_es_Salaam"},{"value":"Africa/Djibouti","name":"Djibouti","id":"Africa/Djibouti"},{"value":"Africa/Douala","name":"Douala","id":"Africa/Douala"},{"value":"Africa/El_Aaiun","name":"El Aaiun","id":"Africa/El_Aaiun"},{"value":"Africa/Freetown","name":"Freetown","id":"Africa/Freetown"},{"value":"Africa/Gaborone","name":"Gaborone","id":"Africa/Gaborone"},{"value":"Africa/Harare","name":"Harare","id":"Africa/Harare"},{"value":"Africa/Johannesburg","name":"Johannesburg","id":"Africa/Johannesburg"},{"value":"Africa/Juba","name":"Juba","id":"Africa/Juba"},{"value":"Africa/Kampala","name":"Kampala","id":"Africa/Kampala"},{"value":"Africa/Khartoum","name":"Khartoum","id":"Africa/Khartoum"},{"value":"Africa/Kigali","name":"Kigali","id":"Africa/Kigali"},{"value":"Africa/Kinshasa","name":"Kinshasa","id":"Africa/Kinshasa"},{"value":"Africa/Lagos","name":"Lagos","id":"Africa/Lagos"},{"value":"Africa/Libreville","name":"Libreville","id":"Africa/Libreville"},{"value":"Africa/Lome","name":"Lome","id":"Africa/Lome"},{"value":"Africa/Luanda","name":"Luanda","id":"Africa/Luanda"},{"value":"Africa/Lubumbashi","name":"Lubumbashi","id":"Africa/Lubumbashi"},{"value":"Africa/Lusaka","name":"Lusaka","id":"Africa/Lusaka"},{"value":"Africa/Malabo","name":"Malabo","id":"Africa/Malabo"},{"value":"Africa/Maputo","name":"Maputo","id":"Africa/Maputo"},{"value":"Africa/Maseru","name":"Maseru","id":"Africa/Maseru"},{"value":"Africa/Mbabane","name":"Mbabane","id":"Africa/Mbabane"},{"value":"Africa/Mogadishu","name":"Mogadishu","id":"Africa/Mogadishu"},{"value":"Africa/Monrovia","name":"Monrovia","id":"Africa/Monrovia"},{"value":"Africa/Nairobi","name":"Nairobi","id":"Africa/Nairobi"},{"value":"Africa/Ndjamena","name":"Ndjamena","id":"Africa/Ndjamena"},{"value":"Africa/Niamey","name":"Niamey","id":"Africa/Niamey"},{"value":"Africa/Nouakchott","name":"Nouakchott","id":"Africa/Nouakchott"},{"value":"Africa/Ouagadougou","name":"Ouagadougou","id":"Africa/Ouagadougou"},{"value":"Africa/Porto-Novo","name":"Porto-Novo","id":"Africa/Porto-Novo"},{"value":"Africa/Sao_Tome","name":"São Tomé","id":"Africa/Sao_Tome"},{"value":"Africa/Tripoli","name":"Tripoli","id":"Africa/Tripoli"},{"value":"Africa/Tunis","name":"Tunis","id":"Africa/Tunis"},{"value":"Africa/Windhoek","name":"Windhoek","id":"Africa/Windhoek"},{"value":"America/Adak","name":"Adak","id":"America/Adak"},{"value":"America/Anchorage","name":"Anchorage","id":"America/Anchorage"},{"value":"America/Anguilla","name":"Anguilla","id":"America/Anguilla"},{"value":"America/Antigua","name":"Antigua","id":"America/Antigua"},{"value":"America/Araguaina","name":"Araguaina","id":"America/Araguaina"},{"value":"America/Argentina/La_Rioja","name":"La Rioja","id":"America/Argentina/La_Rioja"},{"value":"America/Argentina/Rio_Gallegos","name":"Rio Gallegos","id":"America/Argentina/Rio_Gallegos"},{"value":"America/Argentina/Salta","name":"Salta","id":"America/Argentina/Salta"},{"value":"America/Argentina/San_Juan","name":"San Juan","id":"America/Argentina/San_Juan"},{"value":"America/Argentina/San_Luis","name":"San Luis","id":"America/Argentina/San_Luis"},{"value":"America/Argentina/Tucuman","name":"Tucuman","id":"America/Argentina/Tucuman"},{"value":"America/Argentina/Ushuaia","name":"Ushuaia","id":"America/Argentina/Ushuaia"},{"value":"America/Aruba","name":"Aruba","id":"America/Aruba"},{"value":"America/Asuncion","name":"Asunción","id":"America/Asuncion"},{"value":"America/Bahia","name":"Bahia","id":"America/Bahia"},{"value":"America/Bahia_Banderas","name":"Bahia Banderas","id":"America/Bahia_Banderas"},{"value":"America/Barbados","name":"Barbados","id":"America/Barbados"},{"value":"America/Belem","name":"Belem","id":"America/Belem"},{"value":"America/Belize","name":"Belize","id":"America/Belize"},{"value":"America/Blanc-Sablon","name":"Blanc-Sablon","id":"America/Blanc-Sablon"},{"value":"America/Boa_Vista","name":"Boa Vista","id":"America/Boa_Vista"},{"value":"America/Bogota","name":"Bogota","id":"America/Bogota"},{"value":"America/Boise","name":"Boise","id":"America/Boise"},{"value":"America/Buenos_Aires","name":"Buenos Aires","id":"America/Buenos_Aires"},{"value":"America/Cambridge_Bay","name":"Cambridge Bay","id":"America/Cambridge_Bay"},{"value":"America/Campo_Grande","name":"Campo Grande","id":"America/Campo_Grande"},{"value":"America/Cancun","name":"Cancun","id":"America/Cancun"},{"value":"America/Caracas","name":"Caracas","id":"America/Caracas"},{"value":"America/Catamarca","name":"Catamarca","id":"America/Catamarca"},{"value":"America/Cayenne","name":"Cayenne","id":"America/Cayenne"},{"value":"America/Cayman","name":"Cayman","id":"America/Cayman"},{"value":"America/Chicago","name":"Chicago","id":"America/Chicago"},{"value":"America/Chihuahua","name":"Chihuahua","id":"America/Chihuahua"},{"value":"America/Coral_Harbour","name":"Atikokan","id":"America/Coral_Harbour"},{"value":"America/Cordoba","name":"Cordoba","id":"America/Cordoba"},{"value":"America/Costa_Rica","name":"Costa Rica","id":"America/Costa_Rica"},{"value":"America/Creston","name":"Creston","id":"America/Creston"},{"value":"America/Cuiaba","name":"Cuiaba","id":"America/Cuiaba"},{"value":"America/Curacao","name":"Curaçao","id":"America/Curacao"},{"value":"America/Danmarkshavn","name":"Danmarkshavn","id":"America/Danmarkshavn"},{"value":"America/Dawson","name":"Dawson","id":"America/Dawson"},{"value":"America/Dawson_Creek","name":"Dawson Creek","id":"America/Dawson_Creek"},{"value":"America/Denver","name":"Denver","id":"America/Denver"},{"value":"America/Detroit","name":"Detroit","id":"America/Detroit"},{"value":"America/Dominica","name":"Dominica","id":"America/Dominica"},{"value":"America/Edmonton","name":"Edmonton","id":"America/Edmonton"},{"value":"America/Eirunepe","name":"Eirunepe","id":"America/Eirunepe"},{"value":"America/El_Salvador","name":"El Salvador","id":"America/El_Salvador"},{"value":"America/Fort_Nelson","name":"Fort Nelson","id":"America/Fort_Nelson"},{"value":"America/Fortaleza","name":"Fortaleza","id":"America/Fortaleza"},{"value":"America/Glace_Bay","name":"Glace Bay","id":"America/Glace_Bay"},{"value":"America/Godthab","name":"Nuuk","id":"America/Godthab"},{"value":"America/Goose_Bay","name":"Goose Bay","id":"America/Goose_Bay"},{"value":"America/Grand_Turk","name":"Grand Turk","id":"America/Grand_Turk"},{"value":"America/Grenada","name":"Grenada","id":"America/Grenada"},{"value":"America/Guadeloupe","name":"Guadeloupe","id":"America/Guadeloupe"},{"value":"America/Guatemala","name":"Guatemala","id":"America/Guatemala"},{"value":"America/Guayaquil","name":"Guayaquil","id":"America/Guayaquil"},{"value":"America/Guyana","name":"Guyana","id":"America/Guyana"},{"value":"America/Halifax","name":"Halifax","id":"America/Halifax"},{"value":"America/Havana","name":"Havana","id":"America/Havana"},{"value":"America/Hermosillo","name":"Hermosillo","id":"America/Hermosillo"},{"value":"America/Indiana/Knox","name":"Knox, Indiana","id":"America/Indiana/Knox"},{"value":"America/Indiana/Marengo","name":"Marengo, Indiana","id":"America/Indiana/Marengo"},{"value":"America/Indiana/Petersburg","name":"Petersburg, Indiana","id":"America/Indiana/Petersburg"},{"value":"America/Indiana/Tell_City","name":"Tell City, Indiana","id":"America/Indiana/Tell_City"},{"value":"America/Indiana/Vevay","name":"Vevay, Indiana","id":"America/Indiana/Vevay"},{"value":"America/Indiana/Vincennes","name":"Vincennes, Indiana","id":"America/Indiana/Vincennes"},{"value":"America/Indiana/Winamac","name":"Winamac, Indiana","id":"America/Indiana/Winamac"},{"value":"America/Indianapolis","name":"Indianapolis","id":"America/Indianapolis"},{"value":"America/Inuvik","name":"Inuvik","id":"America/Inuvik"},{"value":"America/Iqaluit","name":"Iqaluit","id":"America/Iqaluit"},{"value":"America/Jamaica","name":"Jamaica","id":"America/Jamaica"},{"value":"America/Jujuy","name":"Jujuy","id":"America/Jujuy"},{"value":"America/Juneau","name":"Juneau","id":"America/Juneau"},{"value":"America/Kentucky/Monticello","name":"Monticello, Kentucky","id":"America/Kentucky/Monticello"},{"value":"America/Kralendijk","name":"Kralendijk","id":"America/Kralendijk"},{"value":"America/La_Paz","name":"La Paz","id":"America/La_Paz"},{"value":"America/Lima","name":"Lima","id":"America/Lima"},{"value":"America/Los_Angeles","name":"Los Angeles","id":"America/Los_Angeles"},{"value":"America/Louisville","name":"Louisville","id":"America/Louisville"},{"value":"America/Lower_Princes","name":"Lower Prince’s Quarter","id":"America/Lower_Princes"},{"value":"America/Maceio","name":"Maceio","id":"America/Maceio"},{"value":"America/Managua","name":"Managua","id":"America/Managua"},{"value":"America/Manaus","name":"Manaus","id":"America/Manaus"},{"value":"America/Marigot","name":"Marigot","id":"America/Marigot"},{"value":"America/Martinique","name":"Martinique","id":"America/Martinique"},{"value":"America/Matamoros","name":"Matamoros","id":"America/Matamoros"},{"value":"America/Mazatlan","name":"Mazatlan","id":"America/Mazatlan"},{"value":"America/Mendoza","name":"Mendoza","id":"America/Mendoza"},{"value":"America/Menominee","name":"Menominee","id":"America/Menominee"},{"value":"America/Merida","name":"Merida","id":"America/Merida"},{"value":"America/Metlakatla","name":"Metlakatla","id":"America/Metlakatla"},{"value":"America/Mexico_City","name":"Mexico City","id":"America/Mexico_City"},{"value":"America/Miquelon","name":"Miquelon","id":"America/Miquelon"},{"value":"America/Moncton","name":"Moncton","id":"America/Moncton"},{"value":"America/Monterrey","name":"Monterrey","id":"America/Monterrey"},{"value":"America/Montevideo","name":"Montevideo","id":"America/Montevideo"},{"value":"America/Montserrat","name":"Montserrat","id":"America/Montserrat"},{"value":"America/Nassau","name":"Nassau","id":"America/Nassau"},{"value":"America/New_York","name":"New York","id":"America/New_York"},{"value":"America/Nipigon","name":"Nipigon","id":"America/Nipigon"},{"value":"America/Nome","name":"Nome","id":"America/Nome"},{"value":"America/Noronha","name":"Noronha","id":"America/Noronha"},{"value":"America/North_Dakota/Beulah","name":"Beulah, Bắc Dakota","id":"America/North_Dakota/Beulah"},{"value":"America/North_Dakota/Center","name":"Center, Bắc Dakota","id":"America/North_Dakota/Center"},{"value":"America/North_Dakota/New_Salem","name":"New Salem, Bắc Dakota","id":"America/North_Dakota/New_Salem"},{"value":"America/Ojinaga","name":"Ojinaga","id":"America/Ojinaga"},{"value":"America/Panama","name":"Panama","id":"America/Panama"},{"value":"America/Pangnirtung","name":"Pangnirtung","id":"America/Pangnirtung"},{"value":"America/Paramaribo","name":"Paramaribo","id":"America/Paramaribo"},{"value":"America/Phoenix","name":"Phoenix","id":"America/Phoenix"},{"value":"America/Port-au-Prince","name":"Port-au-Prince","id":"America/Port-au-Prince"},{"value":"America/Port_of_Spain","name":"Port of Spain","id":"America/Port_of_Spain"},{"value":"America/Porto_Velho","name":"Porto Velho","id":"America/Porto_Velho"},{"value":"America/Puerto_Rico","name":"Puerto Rico","id":"America/Puerto_Rico"},{"value":"America/Punta_Arenas","name":"Punta Arenas","id":"America/Punta_Arenas"},{"value":"America/Rainy_River","name":"Rainy River","id":"America/Rainy_River"},{"value":"America/Rankin_Inlet","name":"Rankin Inlet","id":"America/Rankin_Inlet"},{"value":"America/Recife","name":"Recife","id":"America/Recife"},{"value":"America/Regina","name":"Regina","id":"America/Regina"},{"value":"America/Resolute","name":"Resolute","id":"America/Resolute"},{"value":"America/Rio_Branco","name":"Rio Branco","id":"America/Rio_Branco"},{"value":"America/Santa_Isabel","name":"Santa Isabel","id":"America/Santa_Isabel"},{"value":"America/Santarem","name":"Santarem","id":"America/Santarem"},{"value":"America/Santiago","name":"Santiago","id":"America/Santiago"},{"value":"America/Santo_Domingo","name":"Santo Domingo","id":"America/Santo_Domingo"},{"value":"America/Sao_Paulo","name":"Sao Paulo","id":"America/Sao_Paulo"},{"value":"America/Scoresbysund","name":"Ittoqqortoormiit","id":"America/Scoresbysund"},{"value":"America/Sitka","name":"Sitka","id":"America/Sitka"},{"value":"America/St_Barthelemy","name":"St. Barthélemy","id":"America/St_Barthelemy"},{"value":"America/St_Johns","name":"St. John’s","id":"America/St_Johns"},{"value":"America/St_Kitts","name":"St. Kitts","id":"America/St_Kitts"},{"value":"America/St_Lucia","name":"St. Lucia","id":"America/St_Lucia"},{"value":"America/St_Thomas","name":"St. Thomas","id":"America/St_Thomas"},{"value":"America/St_Vincent","name":"St. Vincent","id":"America/St_Vincent"},{"value":"America/Swift_Current","name":"Swift Current","id":"America/Swift_Current"},{"value":"America/Tegucigalpa","name":"Tegucigalpa","id":"America/Tegucigalpa"},{"value":"America/Thule","name":"Thule","id":"America/Thule"},{"value":"America/Thunder_Bay","name":"Thunder Bay","id":"America/Thunder_Bay"},{"value":"America/Tijuana","name":"Tijuana","id":"America/Tijuana"},{"value":"America/Toronto","name":"Toronto","id":"America/Toronto"},{"value":"America/Tortola","name":"Tortola","id":"America/Tortola"},{"value":"America/Vancouver","name":"Vancouver","id":"America/Vancouver"},{"value":"America/Whitehorse","name":"Whitehorse","id":"America/Whitehorse"},{"value":"America/Winnipeg","name":"Winnipeg","id":"America/Winnipeg"},{"value":"America/Yakutat","name":"Yakutat","id":"America/Yakutat"},{"value":"America/Yellowknife","name":"Yellowknife","id":"America/Yellowknife"},{"value":"Antarctica/Casey","name":"Casey","id":"Antarctica/Casey"},{"value":"Antarctica/Davis","name":"Davis","id":"Antarctica/Davis"},{"value":"Antarctica/DumontDUrville","name":"Dumont d’Urville","id":"Antarctica/DumontDUrville"},{"value":"Antarctica/Macquarie","name":"Macquarie","id":"Antarctica/Macquarie"},{"value":"Antarctica/Mawson","name":"Mawson","id":"Antarctica/Mawson"},{"value":"Antarctica/McMurdo","name":"McMurdo","id":"Antarctica/McMurdo"},{"value":"Antarctica/Palmer","name":"Palmer","id":"Antarctica/Palmer"},{"value":"Antarctica/Rothera","name":"Rothera","id":"Antarctica/Rothera"},{"value":"Antarctica/Syowa","name":"Syowa","id":"Antarctica/Syowa"},{"value":"Antarctica/Troll","name":"Troll","id":"Antarctica/Troll"},{"value":"Antarctica/Vostok","name":"Vostok","id":"Antarctica/Vostok"},{"value":"Arctic/Longyearbyen","name":"Longyearbyen","id":"Arctic/Longyearbyen"},{"value":"Asia/Aden","name":"Aden","id":"Asia/Aden"},{"value":"Asia/Almaty","name":"Almaty","id":"Asia/Almaty"},{"value":"Asia/Amman","name":"Amman","id":"Asia/Amman"},{"value":"Asia/Anadyr","name":"Anadyr","id":"Asia/Anadyr"},{"value":"Asia/Aqtau","name":"Aqtau","id":"Asia/Aqtau"},{"value":"Asia/Aqtobe","name":"Aqtobe","id":"Asia/Aqtobe"},{"value":"Asia/Ashgabat","name":"Ashgabat","id":"Asia/Ashgabat"},{"value":"Asia/Atyrau","name":"Atyrau","id":"Asia/Atyrau"},{"value":"Asia/Baghdad","name":"Baghdad","id":"Asia/Baghdad"},{"value":"Asia/Bahrain","name":"Bahrain","id":"Asia/Bahrain"},{"value":"Asia/Baku","name":"Baku","id":"Asia/Baku"},{"value":"Asia/Bangkok","name":"Bangkok","id":"Asia/Bangkok"},{"value":"Asia/Barnaul","name":"Barnaul","id":"Asia/Barnaul"},{"value":"Asia/Beirut","name":"Beirut","id":"Asia/Beirut"},{"value":"Asia/Bishkek","name":"Bishkek","id":"Asia/Bishkek"},{"value":"Asia/Brunei","name":"Brunei","id":"Asia/Brunei"},{"value":"Asia/Calcutta","name":"Kolkata","id":"Asia/Calcutta"},{"value":"Asia/Chita","name":"Chita","id":"Asia/Chita"},{"value":"Asia/Choibalsan","name":"Choibalsan","id":"Asia/Choibalsan"},{"value":"Asia/Colombo","name":"Colombo","id":"Asia/Colombo"},{"value":"Asia/Damascus","name":"Damascus","id":"Asia/Damascus"},{"value":"Asia/Dhaka","name":"Dhaka","id":"Asia/Dhaka"},{"value":"Asia/Dili","name":"Dili","id":"Asia/Dili"},{"value":"Asia/Dubai","name":"Dubai","id":"Asia/Dubai"},{"value":"Asia/Dushanbe","name":"Dushanbe","id":"Asia/Dushanbe"},{"value":"Asia/Famagusta","name":"Famagusta","id":"Asia/Famagusta"},{"value":"Asia/Gaza","name":"Gaza","id":"Asia/Gaza"},{"value":"Asia/Hebron","name":"Hebron","id":"Asia/Hebron"},{"value":"Asia/Hong_Kong","name":"Hồng Kông","id":"Asia/Hong_Kong"},{"value":"Asia/Hovd","name":"Hovd","id":"Asia/Hovd"},{"value":"Asia/Irkutsk","name":"Irkutsk","id":"Asia/Irkutsk"},{"value":"Asia/Jakarta","name":"Jakarta","id":"Asia/Jakarta"},{"value":"Asia/Jayapura","name":"Jayapura","id":"Asia/Jayapura"},{"value":"Asia/Jerusalem","name":"Jerusalem","id":"Asia/Jerusalem"},{"value":"Asia/Kabul","name":"Kabul","id":"Asia/Kabul"},{"value":"Asia/Kamchatka","name":"Kamchatka","id":"Asia/Kamchatka"},{"value":"Asia/Karachi","name":"Karachi","id":"Asia/Karachi"},{"value":"Asia/Katmandu","name":"Kathmandu","id":"Asia/Katmandu"},{"value":"Asia/Khandyga","name":"Khandyga","id":"Asia/Khandyga"},{"value":"Asia/Krasnoyarsk","name":"Krasnoyarsk","id":"Asia/Krasnoyarsk"},{"value":"Asia/Kuala_Lumpur","name":"Kuala Lumpur","id":"Asia/Kuala_Lumpur"},{"value":"Asia/Kuching","name":"Kuching","id":"Asia/Kuching"},{"value":"Asia/Kuwait","name":"Kuwait","id":"Asia/Kuwait"},{"value":"Asia/Macau","name":"Ma Cao","id":"Asia/Macau"},{"value":"Asia/Magadan","name":"Magadan","id":"Asia/Magadan"},{"value":"Asia/Makassar","name":"Makassar","id":"Asia/Makassar"},{"value":"Asia/Manila","name":"Manila","id":"Asia/Manila"},{"value":"Asia/Muscat","name":"Muscat","id":"Asia/Muscat"},{"value":"Asia/Nicosia","name":"Nicosia","id":"Asia/Nicosia"},{"value":"Asia/Novokuznetsk","name":"Novokuznetsk","id":"Asia/Novokuznetsk"},{"value":"Asia/Novosibirsk","name":"Novosibirsk","id":"Asia/Novosibirsk"},{"value":"Asia/Omsk","name":"Omsk","id":"Asia/Omsk"},{"value":"Asia/Oral","name":"Oral","id":"Asia/Oral"},{"value":"Asia/Phnom_Penh","name":"Phnom Penh","id":"Asia/Phnom_Penh"},{"value":"Asia/Pontianak","name":"Pontianak","id":"Asia/Pontianak"},{"value":"Asia/Pyongyang","name":"Bình Nhưỡng","id":"Asia/Pyongyang"},{"value":"Asia/Qatar","name":"Qatar","id":"Asia/Qatar"},{"value":"Asia/Qyzylorda","name":"Qyzylorda","id":"Asia/Qyzylorda"},{"value":"Asia/Rangoon","name":"Rangoon","id":"Asia/Rangoon"},{"value":"Asia/Riyadh","name":"Riyadh","id":"Asia/Riyadh"},{"value":"Asia/Saigon","name":"TP Hồ Chí Minh","id":"Asia/Saigon"},{"value":"Asia/Sakhalin","name":"Sakhalin","id":"Asia/Sakhalin"},{"value":"Asia/Samarkand","name":"Samarkand","id":"Asia/Samarkand"},{"value":"Asia/Seoul","name":"Seoul","id":"Asia/Seoul"},{"value":"Asia/Shanghai","name":"Thượng Hải","id":"Asia/Shanghai"},{"value":"Asia/Singapore","name":"Singapore","id":"Asia/Singapore"},{"value":"Asia/Srednekolymsk","name":"Srednekolymsk","id":"Asia/Srednekolymsk"},{"value":"Asia/Taipei","name":"Đài Bắc","id":"Asia/Taipei"},{"value":"Asia/Tashkent","name":"Tashkent","id":"Asia/Tashkent"},{"value":"Asia/Tbilisi","name":"Tbilisi","id":"Asia/Tbilisi"},{"value":"Asia/Tehran","name":"Tehran","id":"Asia/Tehran"},{"value":"Asia/Thimphu","name":"Thimphu","id":"Asia/Thimphu"},{"value":"Asia/Tokyo","name":"Tokyo","id":"Asia/Tokyo"},{"value":"Asia/Tomsk","name":"Tomsk","id":"Asia/Tomsk"},{"value":"Asia/Ulaanbaatar","name":"Ulaanbaatar","id":"Asia/Ulaanbaatar"},{"value":"Asia/Urumqi","name":"Urumqi","id":"Asia/Urumqi"},{"value":"Asia/Ust-Nera","name":"Ust-Nera","id":"Asia/Ust-Nera"},{"value":"Asia/Vientiane","name":"Viêng Chăn","id":"Asia/Vientiane"},{"value":"Asia/Vladivostok","name":"Vladivostok","id":"Asia/Vladivostok"},{"value":"Asia/Yakutsk","name":"Yakutsk","id":"Asia/Yakutsk"},{"value":"Asia/Yekaterinburg","name":"Yekaterinburg","id":"Asia/Yekaterinburg"},{"value":"Asia/Yerevan","name":"Yerevan","id":"Asia/Yerevan"},{"value":"Atlantic/Azores","name":"Azores","id":"Atlantic/Azores"},{"value":"Atlantic/Bermuda","name":"Bermuda","id":"Atlantic/Bermuda"},{"value":"Atlantic/Canary","name":"Canary","id":"Atlantic/Canary"},{"value":"Atlantic/Cape_Verde","name":"Cape Verde","id":"Atlantic/Cape_Verde"},{"value":"Atlantic/Faeroe","name":"Faroe","id":"Atlantic/Faeroe"},{"value":"Atlantic/Madeira","name":"Madeira","id":"Atlantic/Madeira"},{"value":"Atlantic/Reykjavik","name":"Reykjavik","id":"Atlantic/Reykjavik"},{"value":"Atlantic/South_Georgia","name":"Nam Georgia","id":"Atlantic/South_Georgia"},{"value":"Atlantic/St_Helena","name":"St. Helena","id":"Atlantic/St_Helena"},{"value":"Atlantic/Stanley","name":"Stanley","id":"Atlantic/Stanley"},{"value":"Australia/Adelaide","name":"Adelaide","id":"Australia/Adelaide"},{"value":"Australia/Brisbane","name":"Brisbane","id":"Australia/Brisbane"},{"value":"Australia/Broken_Hill","name":"Broken Hill","id":"Australia/Broken_Hill"},{"value":"Australia/Currie","name":"Currie","id":"Australia/Currie"},{"value":"Australia/Darwin","name":"Darwin","id":"Australia/Darwin"},{"value":"Australia/Eucla","name":"Eucla","id":"Australia/Eucla"},{"value":"Australia/Hobart","name":"Hobart","id":"Australia/Hobart"},{"value":"Australia/Lindeman","name":"Lindeman","id":"Australia/Lindeman"},{"value":"Australia/Lord_Howe","name":"Lord Howe","id":"Australia/Lord_Howe"},{"value":"Australia/Melbourne","name":"Melbourne","id":"Australia/Melbourne"},{"value":"Australia/Perth","name":"Perth","id":"Australia/Perth"},{"value":"Australia/Sydney","name":"Sydney","id":"Australia/Sydney"},{"value":"Etc/UTC","name":"Giờ Phối hợp Quốc tếUTC","id":"Etc/UTC"},{"value":"Europe/Amsterdam","name":"Amsterdam","id":"Europe/Amsterdam"},{"value":"Europe/Andorra","name":"Andorra","id":"Europe/Andorra"},{"value":"Europe/Astrakhan","name":"Astrakhan","id":"Europe/Astrakhan"},{"value":"Europe/Athens","name":"Athens","id":"Europe/Athens"},{"value":"Europe/Belgrade","name":"Belgrade","id":"Europe/Belgrade"},{"value":"Europe/Berlin","name":"Berlin","id":"Europe/Berlin"},{"value":"Europe/Bratislava","name":"Bratislava","id":"Europe/Bratislava"},{"value":"Europe/Brussels","name":"Brussels","id":"Europe/Brussels"},{"value":"Europe/Bucharest","name":"Bucharest","id":"Europe/Bucharest"},{"value":"Europe/Budapest","name":"Budapest","id":"Europe/Budapest"},{"value":"Europe/Busingen","name":"Busingen","id":"Europe/Busingen"},{"value":"Europe/Chisinau","name":"Chisinau","id":"Europe/Chisinau"},{"value":"Europe/Copenhagen","name":"Copenhagen","id":"Europe/Copenhagen"},{"value":"Europe/Dublin","name":"Giờ chuẩn Ai-lenDublin","id":"Europe/Dublin"},{"value":"Europe/Gibraltar","name":"Gibraltar","id":"Europe/Gibraltar"},{"value":"Europe/Guernsey","name":"Guernsey","id":"Europe/Guernsey"},{"value":"Europe/Helsinki","name":"Helsinki","id":"Europe/Helsinki"},{"value":"Europe/Isle_of_Man","name":"Đảo Man","id":"Europe/Isle_of_Man"},{"value":"Europe/Istanbul","name":"Istanbul","id":"Europe/Istanbul"},{"value":"Europe/Jersey","name":"Jersey","id":"Europe/Jersey"},{"value":"Europe/Kaliningrad","name":"Kaliningrad","id":"Europe/Kaliningrad"},{"value":"Europe/Kiev","name":"Kiev","id":"Europe/Kiev"},{"value":"Europe/Kirov","name":"Kirov","id":"Europe/Kirov"},{"value":"Europe/Lisbon","name":"Lisbon","id":"Europe/Lisbon"},{"value":"Europe/Ljubljana","name":"Ljubljana","id":"Europe/Ljubljana"},{"value":"Europe/London","name":"Giờ Mùa Hè AnhLondon","id":"Europe/London"},{"value":"Europe/Luxembourg","name":"Luxembourg","id":"Europe/Luxembourg"},{"value":"Europe/Madrid","name":"Madrid","id":"Europe/Madrid"},{"value":"Europe/Malta","name":"Malta","id":"Europe/Malta"},{"value":"Europe/Mariehamn","name":"Mariehamn","id":"Europe/Mariehamn"},{"value":"Europe/Minsk","name":"Minsk","id":"Europe/Minsk"},{"value":"Europe/Monaco","name":"Monaco","id":"Europe/Monaco"},{"value":"Europe/Moscow","name":"Mát-xcơ-va","id":"Europe/Moscow"},{"value":"Europe/Oslo","name":"Oslo","id":"Europe/Oslo"},{"value":"Europe/Paris","name":"Paris","id":"Europe/Paris"},{"value":"Europe/Podgorica","name":"Podgorica","id":"Europe/Podgorica"},{"value":"Europe/Prague","name":"Praha","id":"Europe/Prague"},{"value":"Europe/Riga","name":"Riga","id":"Europe/Riga"},{"value":"Europe/Rome","name":"Rome","id":"Europe/Rome"},{"value":"Europe/Samara","name":"Samara","id":"Europe/Samara"},{"value":"Europe/San_Marino","name":"San Marino","id":"Europe/San_Marino"},{"value":"Europe/Sarajevo","name":"Sarajevo","id":"Europe/Sarajevo"},{"value":"Europe/Saratov","name":"Saratov","id":"Europe/Saratov"},{"value":"Europe/Simferopol","name":"Simferopol","id":"Europe/Simferopol"},{"value":"Europe/Skopje","name":"Skopje","id":"Europe/Skopje"},{"value":"Europe/Sofia","name":"Sofia","id":"Europe/Sofia"},{"value":"Europe/Stockholm","name":"Stockholm","id":"Europe/Stockholm"},{"value":"Europe/Tallinn","name":"Tallinn","id":"Europe/Tallinn"},{"value":"Europe/Tirane","name":"Tirane","id":"Europe/Tirane"},{"value":"Europe/Ulyanovsk","name":"Ulyanovsk","id":"Europe/Ulyanovsk"},{"value":"Europe/Uzhgorod","name":"Uzhhorod","id":"Europe/Uzhgorod"},{"value":"Europe/Vaduz","name":"Vaduz","id":"Europe/Vaduz"},{"value":"Europe/Vatican","name":"Vatican","id":"Europe/Vatican"},{"value":"Europe/Vienna","name":"Vienna","id":"Europe/Vienna"},{"value":"Europe/Vilnius","name":"Vilnius","id":"Europe/Vilnius"},{"value":"Europe/Volgograd","name":"Volgograd","id":"Europe/Volgograd"},{"value":"Europe/Warsaw","name":"Warsaw","id":"Europe/Warsaw"},{"value":"Europe/Zagreb","name":"Zagreb","id":"Europe/Zagreb"},{"value":"Europe/Zaporozhye","name":"Zaporozhye","id":"Europe/Zaporozhye"},{"value":"Europe/Zurich","name":"Zurich","id":"Europe/Zurich"},{"value":"Indian/Antananarivo","name":"Antananarivo","id":"Indian/Antananarivo"},{"value":"Indian/Chagos","name":"Chagos","id":"Indian/Chagos"},{"value":"Indian/Christmas","name":"Christmas","id":"Indian/Christmas"},{"value":"Indian/Cocos","name":"Cocos","id":"Indian/Cocos"},{"value":"Indian/Comoro","name":"Comoro","id":"Indian/Comoro"},{"value":"Indian/Kerguelen","name":"Kerguelen","id":"Indian/Kerguelen"},{"value":"Indian/Mahe","name":"Mahe","id":"Indian/Mahe"},{"value":"Indian/Maldives","name":"Maldives","id":"Indian/Maldives"},{"value":"Indian/Mauritius","name":"Mauritius","id":"Indian/Mauritius"},{"value":"Indian/Mayotte","name":"Mayotte","id":"Indian/Mayotte"},{"value":"Indian/Reunion","name":"Réunion","id":"Indian/Reunion"},{"value":"Pacific/Apia","name":"Apia","id":"Pacific/Apia"},{"value":"Pacific/Auckland","name":"Auckland","id":"Pacific/Auckland"},{"value":"Pacific/Bougainville","name":"Bougainville","id":"Pacific/Bougainville"},{"value":"Pacific/Chatham","name":"Chatham","id":"Pacific/Chatham"},{"value":"Pacific/Easter","name":"Easter","id":"Pacific/Easter"},{"value":"Pacific/Efate","name":"Efate","id":"Pacific/Efate"},{"value":"Pacific/Enderbury","name":"Enderbury","id":"Pacific/Enderbury"},{"value":"Pacific/Fakaofo","name":"Fakaofo","id":"Pacific/Fakaofo"},{"value":"Pacific/Fiji","name":"Fiji","id":"Pacific/Fiji"},{"value":"Pacific/Funafuti","name":"Funafuti","id":"Pacific/Funafuti"},{"value":"Pacific/Galapagos","name":"Galapagos","id":"Pacific/Galapagos"},{"value":"Pacific/Gambier","name":"Gambier","id":"Pacific/Gambier"},{"value":"Pacific/Guadalcanal","name":"Guadalcanal","id":"Pacific/Guadalcanal"},{"value":"Pacific/Guam","name":"Guam","id":"Pacific/Guam"},{"value":"Pacific/Honolulu","name":"Giờ HSTHSTHDTHonolulu","id":"Pacific/Honolulu"},{"value":"Pacific/Johnston","name":"Johnston","id":"Pacific/Johnston"},{"value":"Pacific/Kiritimati","name":"Kiritimati","id":"Pacific/Kiritimati"},{"value":"Pacific/Kosrae","name":"Kosrae","id":"Pacific/Kosrae"},{"value":"Pacific/Kwajalein","name":"Kwajalein","id":"Pacific/Kwajalein"},{"value":"Pacific/Majuro","name":"Majuro","id":"Pacific/Majuro"},{"value":"Pacific/Marquesas","name":"Marquesas","id":"Pacific/Marquesas"},{"value":"Pacific/Midway","name":"Midway","id":"Pacific/Midway"},{"value":"Pacific/Nauru","name":"Nauru","id":"Pacific/Nauru"},{"value":"Pacific/Niue","name":"Niue","id":"Pacific/Niue"},{"value":"Pacific/Norfolk","name":"Norfolk","id":"Pacific/Norfolk"},{"value":"Pacific/Noumea","name":"Noumea","id":"Pacific/Noumea"},{"value":"Pacific/Pago_Pago","name":"Pago Pago","id":"Pacific/Pago_Pago"},{"value":"Pacific/Palau","name":"Palau","id":"Pacific/Palau"},{"value":"Pacific/Pitcairn","name":"Pitcairn","id":"Pacific/Pitcairn"},{"value":"Pacific/Ponape","name":"Pohnpei","id":"Pacific/Ponape"},{"value":"Pacific/Port_Moresby","name":"Port Moresby","id":"Pacific/Port_Moresby"},{"value":"Pacific/Rarotonga","name":"Rarotonga","id":"Pacific/Rarotonga"},{"value":"Pacific/Saipan","name":"Saipan","id":"Pacific/Saipan"},{"value":"Pacific/Tahiti","name":"Tahiti","id":"Pacific/Tahiti"},{"value":"Pacific/Tarawa","name":"Tarawa","id":"Pacific/Tarawa"},{"value":"Pacific/Tongatapu","name":"Tongatapu","id":"Pacific/Tongatapu"},{"value":"Pacific/Truk","name":"Chuuk","id":"Pacific/Truk"},{"value":"Pacific/Wake","name":"Wake","id":"Pacific/Wake"},{"value":"Pacific/Wallis","name":"Wallis","id":"Pacific/Wallis"}];
};

return moment;
})));

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM YYYY'); };
moment.fn.longDate = function(){ return this.format('D MMMM YYYY LT'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
